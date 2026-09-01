import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { verifyPartnerToken, hashPartnerToken, PartnerTokenVerificationError } from '@/lib/partners/token'

export const runtime = 'nodejs'

const BUCKET = 'partner-terms-documents'
const SIGNED_URL_TTL = 3600

/**
 * GET /api/redeem/preview?token=... — UNAUTHENTICATED. Lets a brand-new
 * candidate see what they're about to accept (and their partner's
 * community link, if any) before they even have an account — the token
 * itself is enough identity to resolve this; verified the same way
 * POST /api/redeem already verifies it. No candidate PII beyond what's
 * already inside the token (email, disciplines) is ever returned.
 *
 * This is a PREVIEW only — nothing is written here. The actual acceptance
 * record is created by POST /api/redeem, right after the candidate
 * authenticates, using the currently-active versions at that moment (not
 * whatever this preview happened to show, which could be stale by then).
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  let claims
  try {
    claims = await verifyPartnerToken(token)
  } catch (e) {
    if (e instanceof PartnerTokenVerificationError) {
      const status = e.code === 'EXPIRED' ? 410 : 400
      return NextResponse.json({ error: e.code === 'EXPIRED' ? 'token expired' : 'invalid token' }, { status })
    }
    throw e
  }

  const { data: row } = await supabaseServer
    .from('partner_tokens')
    .select('partner_id, requires_programme_terms, redeemed_at, revoked_at, expires_at')
    .eq('token_hash', hashPartnerToken(token))
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'token not found' }, { status: 404 })
  if (row.revoked_at !== null) return NextResponse.json({ error: 'token revoked' }, { status: 403 })
  if (row.redeemed_at !== null) return NextResponse.json({ error: 'token already redeemed' }, { status: 409 })
  if (new Date(row.expires_at) <= new Date()) return NextResponse.json({ error: 'token expired' }, { status: 410 })

  const partnerId = row.partner_id as string

  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name, community_url')
    .eq('id', partnerId)
    .maybeSingle()

  const docs: {
    document_type: 'platform_terms' | 'partner_programme_terms'
    partner_id: string | null
    partner_name: string | null
    partner_contact_email: string | null
    version: string
    body: string | null
    source_file_type: string | null
    signed_url: string | null
  }[] = []

  const { data: platform } = await supabaseServer
    .from('terms_documents')
    .select('version, body')
    .eq('document_type', 'platform_terms')
    .eq('is_active', true)
    .maybeSingle()
  if (platform) {
    docs.push({
      document_type: 'platform_terms',
      partner_id: null,
      partner_name: null,
      partner_contact_email: null,
      version: platform.version as string,
      body: platform.body as string,
      source_file_type: null,
      signed_url: null,
    })
  }

  if (row.requires_programme_terms) {
    const { data: programme } = await supabaseServer
      .from('terms_documents')
      .select('version, body, source_storage_path, source_file_type')
      .eq('document_type', 'partner_programme_terms')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .maybeSingle()

    if (programme) {
      let signedUrl: string | null = null
      if (programme.source_storage_path) {
        const { data: signed } = await supabaseServer.storage
          .from(BUCKET)
          .createSignedUrl(programme.source_storage_path as string, SIGNED_URL_TTL)
        signedUrl = signed?.signedUrl ?? null
      }
      docs.push({
        document_type: 'partner_programme_terms',
        partner_id: partnerId,
        partner_name: (partner?.name as string | null) ?? null,
        partner_contact_email: null,
        version: programme.version as string,
        body: (programme.body as string | null) ?? null,
        source_file_type: (programme.source_file_type as string | null) ?? null,
        signed_url: signedUrl,
      })
    }
  }

  return NextResponse.json({
    docs,
    community_url: (partner?.community_url as string | null) ?? null,
    partner_name: (partner?.name as string | null) ?? null,
    candidate_email: claims.candidate_email,
  })
}

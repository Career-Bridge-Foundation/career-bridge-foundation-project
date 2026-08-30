import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/supabase/server'
import { sendTermsAcceptedEmail } from '@/lib/email/termsAcceptedNotifications'

export const runtime = 'nodejs'

type AcceptItem = { document_type: 'platform_terms' | 'partner_programme_terms'; partner_id?: string | null; version: string }

/**
 * POST /api/candidate/accept — { acceptances: [{ document_type, partner_id?, version }] }
 *
 * The client names WHICH version it saw (never its hash — that's looked up
 * server-side, never trusted from the client). Verifies each named version
 * genuinely exists in terms_documents (not necessarily still the active
 * one — see the "republished mid-session" edge case: a candidate reading an
 * already-loaded acceptance screen when a new version goes live still gets
 * their in-flight acceptance honoured; they're re-prompted for the newer
 * version on their NEXT request, not mid-flow).
 *
 * Uses the per-request session client (not the service-role client) for the
 * RPC call specifically, because record_candidate_acceptance() derives
 * candidate_id from auth.uid() — that only resolves under the caller's own
 * session, never under a service-role key.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const items = (json as { acceptances?: unknown })?.acceptances
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'acceptances must be a non-empty array' }, { status: 400 })
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null
  const userAgent = request.headers.get('user-agent')

  const verified: { document_type: string; partner_id: string | null; version: string; document_hash: string }[] = []

  for (const raw of items as AcceptItem[]) {
    if (!raw || typeof raw.document_type !== 'string' || typeof raw.version !== 'string') {
      return NextResponse.json({ error: 'each acceptance needs document_type and version' }, { status: 400 })
    }
    if (raw.document_type !== 'platform_terms' && raw.document_type !== 'partner_programme_terms') {
      return NextResponse.json({ error: 'invalid document_type' }, { status: 400 })
    }
    const partnerId = raw.document_type === 'partner_programme_terms' ? (raw.partner_id ?? null) : null
    if (raw.document_type === 'partner_programme_terms' && !partnerId) {
      return NextResponse.json({ error: 'partner_programme_terms requires partner_id' }, { status: 400 })
    }

    let query = supabaseServer
      .from('terms_documents')
      .select('document_hash')
      .eq('document_type', raw.document_type)
      .eq('version', raw.version)
    query = partnerId ? query.eq('partner_id', partnerId) : query.is('partner_id', null)
    const { data: doc } = await query.maybeSingle()

    if (!doc) {
      return NextResponse.json(
        { error: `no such document: ${raw.document_type} v${raw.version}` },
        { status: 400 }
      )
    }

    verified.push({
      document_type: raw.document_type,
      partner_id: partnerId,
      version: raw.version,
      document_hash: doc.document_hash as string,
    })
  }

  // record_candidate_acceptance() now also enqueues provisioning (flips
  // provisioning_status to 'pending' when applicable) IN THE SAME
  // transaction as the acceptance inserts — see supabase/migrations/
  // 20260830_001_atomic_provisioning_enqueue.sql. Previously that was a
  // separate best-effort step here, which could leave an accepted candidate
  // with provisioning silently never queued if it threw.
  const { error: rpcError } = await supabase.rpc('record_candidate_acceptance', {
    p_acceptances: verified,
    p_ip: ip,
    p_user_agent: userAgent,
  })
  if (rpcError) {
    console.error('[candidate/accept] rpc failed', rpcError.message)
    return NextResponse.json({ error: 'could not record acceptance' }, { status: 500 })
  }

  // Best-effort copy-of-acceptance emails (Spec 19 decision 6) — one per
  // document, never blocking the recorded acceptance on delivery. Emails are
  // not part of the atomicity guarantee above by design (an email provider
  // outage must never roll back a legally-meaningful acceptance).
  if (user.email) {
    const acceptedAt = new Date().toISOString()
    for (const v of verified) {
      sendTermsAcceptedEmail({
        to: user.email,
        documentType: v.document_type as 'platform_terms' | 'partner_programme_terms',
        partnerId: v.partner_id,
        version: v.version,
        acceptedAt,
      }).catch((err) => console.error('[candidate/accept] confirmation email failed', v.document_type, err))
    }
  }

  return NextResponse.json({ success: true })
}

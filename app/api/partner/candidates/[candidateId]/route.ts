import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { COUNTRIES } from '@/lib/countries'

export const runtime = 'nodejs'

const VALID_CODES = new Set(COUNTRIES.map((c) => c.code))

/**
 * PATCH /api/partner/candidates/[candidateId] — correct a candidate's
 * country after provisioning. Scoped the same way as getPartnerCandidateDetail
 * (lib/partners/candidateDetail.ts): the candidate must be currently entitled
 * BY THIS PARTNER, checked before any write — candidateId from the URL is a
 * filter within that scope, never trusted on its own.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { candidateId } = await params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const country = (json as { country?: unknown })?.country
  if (typeof country !== 'string' || !VALID_CODES.has(country)) {
    return NextResponse.json({ error: 'country must be a valid ISO country code' }, { status: 400 })
  }

  // Ownership gate: candidate must be entitled by this partner, active.
  const { data: ents } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id')
    .eq('granted_by_partner', ctx.partnerId!)
    .eq('candidate_id', candidateId)
    .is('revoked_at', null)
    .limit(1)
  if (!ents?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabaseServer
    .from('portfolio_profiles')
    .update({ country })
    .eq('id', candidateId)

  if (error) {
    console.error('[partner/candidates PATCH] update failed', error.message)
    return NextResponse.json({ error: 'could not update country' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, country })
}

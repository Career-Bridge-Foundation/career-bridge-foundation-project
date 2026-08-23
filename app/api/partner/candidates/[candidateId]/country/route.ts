import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * PATCH /api/partner/candidates/:id/country
 *
 * Partner-admin edit path for a candidate's country (country-and-pricing
 * amendment). Freely editable until the candidate's first purchase; once
 * portfolio_profiles.country_locked_at is set, this route rejects — only a
 * super-admin path (not built in this slice) may edit past that point. This
 * closes the arbitrage of flipping a candidate to a cheaper region, letting
 * them buy, then flipping back.
 *
 * Body: { country: string }  — ISO 3166-1 alpha-2.
 *
 * Tenant gate mirrors getPartnerCandidateDetail (lib/partners/candidateDetail.ts):
 * the candidate must be entitled by THIS partner, active, checked BEFORE any
 * write — a foreign/unknown id returns 404, no existence leak.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { candidateId } = await params

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const rawCountry = (body as { country?: unknown })?.country
    if (typeof rawCountry !== 'string' || rawCountry.trim().length !== 2) {
      return NextResponse.json({ error: 'country must be a 2-letter ISO 3166-1 alpha-2 code' }, { status: 400 })
    }
    const country = rawCountry.trim().toUpperCase()

    // ── GATE: candidate must be entitled BY THIS PARTNER, active ──
    const { data: ents } = await supabaseServer
      .from('candidate_entitlements')
      .select('candidate_id')
      .eq('granted_by_partner', ctx.partnerId!)
      .eq('candidate_id', candidateId)
      .is('revoked_at', null)
      .limit(1)

    if (!ents?.length) {
      return NextResponse.json({ error: 'candidate not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, country_locked_at')
      .eq('id', candidateId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'candidate not found' }, { status: 404 })
    }

    if (profile.country_locked_at) {
      return NextResponse.json(
        { error: 'country is locked after first purchase — contact Evidentize to change it', code: 'country_locked' },
        { status: 403 },
      )
    }

    const { error: updateError } = await supabaseServer
      .from('portfolio_profiles')
      .update({ country })
      .eq('id', candidateId)

    if (updateError) {
      console.error('[partner/candidates/country] update failed', updateError)
      return NextResponse.json({ error: 'could not update country' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, country })
  } catch (err) {
    console.error('[partner/candidates/country] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

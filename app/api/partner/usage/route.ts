import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/partner/usage
 *
 * Returns seat-consumption metrics for the authenticated partner.
 *
 * A seat = one UNIQUE candidate (not per discipline-redemption). A candidate
 * who redeemed two disciplines counts as ONE seat. Consumption is permanent
 * and is triggered by redemption (a candidate_entitlements row with
 * granted_by_partner set). See Spec 05.5.
 *
 * The headline figure is `seatsConsumed` = count(distinct candidate_id).
 * Backing detail lists each distinct candidate with the disciplines they
 * redeemed and their first-redemption date, for invoice reconciliation.
 */
export async function GET() {
  try {
    // AUTH — session-based: must be a partner with a linked org.
    let ctx
    try {
      ctx = await requirePartner()
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const partnerId = ctx.partnerId as string

    // Fetch this partner's granted entitlements. Service-role read: we are
    // aggregating the partner's own data and want it independent of the
    // candidate-facing RLS on candidate_entitlements.
    const { data, error } = await supabaseServer
      .from('candidate_entitlements')
      .select('candidate_id, discipline, granted_at')
      .eq('granted_by_partner', partnerId)
      .is('revoked_at', null)

    if (error) {
      console.error('[partner/usage] query failed', error.message)
      return NextResponse.json({ error: 'could not load usage' }, { status: 500 })
    }

    const rows = data ?? []

    // Collapse to distinct candidates. Each candidate = one seat, regardless
    // of how many disciplines they redeemed. Track their disciplines and the
    // earliest grant (first-redemption date) for the backing detail.
    const byCandidate = new Map<
      string,
      { candidateId: string; disciplines: string[]; firstRedeemedAt: string }
    >()

    for (const row of rows) {
      const id = row.candidate_id as string
      const discipline = row.discipline as string
      const grantedAt = row.granted_at as string

      const existing = byCandidate.get(id)
      if (!existing) {
        byCandidate.set(id, {
          candidateId: id,
          disciplines: [discipline],
          firstRedeemedAt: grantedAt,
        })
      } else {
        if (!existing.disciplines.includes(discipline)) {
          existing.disciplines.push(discipline)
        }
        if (grantedAt < existing.firstRedeemedAt) {
          existing.firstRedeemedAt = grantedAt
        }
      }
    }

    const candidates = Array.from(byCandidate.values())

    return NextResponse.json(
      {
        seatsConsumed: candidates.length,
        candidates,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[partner/usage] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

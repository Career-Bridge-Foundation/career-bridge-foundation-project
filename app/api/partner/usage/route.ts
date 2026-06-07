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
 * granted_by_partner set). Revoked entitlements are excluded. See Spec 05.5.
 *
 * `seatsConsumed` = count(distinct candidate_id), all-time.
 * `candidates` = per-candidate backing detail for invoice reconciliation.
 *
 * Optional query params for periodic (e.g. monthly) invoicing:
 *   ?period_start=ISO&period_end=ISO
 * When both are provided, `seatsThisPeriod` counts candidates whose FIRST
 * redemption (earliest granted_at) falls within [period_start, period_end).
 * A candidate is billed to the period they first consumed a seat, consistent
 * with per-candidate, permanent counting.
 */
export async function GET(request: Request) {
  try {
    // AUTH — session-based: must be a partner with a linked org.
    let ctx
    try {
      ctx = await requirePartner()
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const partnerId = ctx.partnerId as string

    // Optional billing-period window.
    const { searchParams } = new URL(request.url)
    const periodStartRaw = searchParams.get('period_start')
    const periodEndRaw = searchParams.get('period_end')

    let periodStart: Date | null = null
    let periodEnd: Date | null = null
    if (periodStartRaw || periodEndRaw) {
      if (!periodStartRaw || !periodEndRaw) {
        return NextResponse.json(
          { error: 'period_start and period_end must both be provided' },
          { status: 400 }
        )
      }
      periodStart = new Date(periodStartRaw)
      periodEnd = new Date(periodEndRaw)
      if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
        return NextResponse.json(
          { error: 'period_start and period_end must be valid dates' },
          { status: 400 }
        )
      }
    }

    // Fetch this partner's non-revoked granted entitlements. Service-role read:
    // aggregating the partner's own data, independent of candidate-facing RLS.
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
    // of how many disciplines they redeemed. Track disciplines and the
    // earliest grant (first-redemption date) for backing detail + period logic.
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

    const response: {
      seatsConsumed: number
      candidates: typeof candidates
      seatsThisPeriod?: number
      period?: { start: string; end: string }
    } = {
      seatsConsumed: candidates.length,
      candidates,
    }

    // Per-period count: candidates whose FIRST redemption falls in the window.
    if (periodStart && periodEnd) {
      const seatsThisPeriod = candidates.filter((c) => {
        const first = new Date(c.firstRedeemedAt).getTime()
        return first >= periodStart!.getTime() && first < periodEnd!.getTime()
      }).length
      response.seatsThisPeriod = seatsThisPeriod
      response.period = {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      }
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    console.error('[partner/usage] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

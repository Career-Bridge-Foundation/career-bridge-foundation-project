import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerUsage } from '@/lib/partners/usage'

export const runtime = 'nodejs'

/**
 * GET /api/partner/usage
 *
 * Seat-consumption metrics for the authenticated partner (Spec 05.5). Thin
 * delegate: auth + period-param parsing here, seat counting in getPartnerUsage().
 *
 * Response:
 *   seatsConsumed    count(distinct candidate_id), all-time
 *   seatsCommitted   partners.volume_commitment_seats, or null if none set
 *   seatsRemaining   committed - consumed, or null if no commitment
 *   candidates       per-candidate backing detail (id, disciplines, first redeem)
 *   seatsThisPeriod  (only with period params) candidates first redeemed in window
 *   period           (only with period params) the window used
 *
 * Optional: ?period_start=ISO&period_end=ISO — first-redemption in [start, end)
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

    let period: { start: Date; end: Date } | null = null
    if (periodStartRaw || periodEndRaw) {
      if (!periodStartRaw || !periodEndRaw) {
        return NextResponse.json(
          { error: 'period_start and period_end must both be provided' },
          { status: 400 }
        )
      }
      const start = new Date(periodStartRaw)
      const end = new Date(periodEndRaw)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: 'period_start and period_end must be valid dates' },
          { status: 400 }
        )
      }
      period = { start, end }
    }

    try {
      const usage = await getPartnerUsage(partnerId, period)
      return NextResponse.json(usage, { status: 200 })
    } catch (e) {
      console.error('[partner/usage] query failed', e)
      return NextResponse.json({ error: 'could not load usage' }, { status: 500 })
    }
  } catch (err) {
    console.error('[partner/usage] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

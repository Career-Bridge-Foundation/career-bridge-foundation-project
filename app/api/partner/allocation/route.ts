import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { getAllocationState, CeilingError } from '@/lib/entitlement/ceiling'

export const runtime = 'nodejs'

/**
 * GET /api/partner/allocation
 *
 * Returns the authenticated partner's active allocation state:
 *   committed      — the credit ceiling for the current contract period
 *   bufferPct      — overdraft buffer percentage (default 10)
 *   hardCeiling    — committed + buffer (absolute max before hard-stop)
 *   consumed       — credits actually activated against this partner's allocation
 *   reserved       — credits reserved by non-revoked codes (may or may not be redeemed)
 *   remaining      — hardCeiling - reserved (headroom available for new code minting)
 *   bufferState    — ok | warning | at_ceiling | hard_stop
 *
 * bufferState thresholds are based on consumed vs committed:
 *   ok          consumed < 80% of committed
 *   warning     80% <= consumed < 100% of committed  → show banner, send email
 *   at_ceiling  consumed >= committed but < hardCeiling (in the buffer)
 *   hard_stop   consumed >= hardCeiling → new activations blocked
 */
export async function GET() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const state = await getAllocationState(ctx.partnerId!)
    return NextResponse.json(state)
  } catch (err) {
    if (err instanceof CeilingError && err.code === 'no_active_allocation') {
      return NextResponse.json({ error: 'no active allocation for this partner' }, { status: 404 })
    }
    console.error('[partner/allocation] query failed', err)
    return NextResponse.json({ error: 'could not load allocation' }, { status: 500 })
  }
}

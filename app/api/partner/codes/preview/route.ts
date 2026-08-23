import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { getAllocationState, CeilingError } from '@/lib/entitlement/ceiling'

export const runtime = 'nodejs'

/**
 * POST /api/partner/codes/preview
 *
 * Returns reserved value, resulting remaining ceiling and buffer state for
 * a proposed mint, WITHOUT minting. Backs the mint form's pre-confirmation
 * display (Spec 18: "The confirm action is disabled until the preview has
 * resolved. A mint that would exceed remaining ceiling plus buffer is
 * rejected at the preview stage with the shortfall stated, not at submission").
 *
 * Body: { credits_per_redemption: integer, quantity: integer }
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const { credits_per_redemption, quantity } = body as {
      credits_per_redemption?: unknown
      quantity?: unknown
    }

    if (!Number.isInteger(credits_per_redemption) || (credits_per_redemption as number) < 1) {
      return NextResponse.json({ error: 'credits_per_redemption must be a positive integer' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || (quantity as number) < 1) {
      return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
    }

    const reservedValue = (credits_per_redemption as number) * (quantity as number)

    let state
    try {
      state = await getAllocationState(ctx.partnerId!)
    } catch (err) {
      if (err instanceof CeilingError && err.code === 'no_active_allocation') {
        return NextResponse.json(
          { error: 'no active allocation — contact Evidentize to set up your credit ceiling' },
          { status: 422 },
        )
      }
      throw err
    }

    const remainingAfter = state.hardCeiling - state.reserved - reservedValue
    const wouldExceed = remainingAfter < 0

    return NextResponse.json({
      reserved: reservedValue,
      current_reserved: state.reserved,
      hard_ceiling: state.hardCeiling,
      remaining_before: state.hardCeiling - state.reserved,
      remaining_after: wouldExceed ? state.hardCeiling - state.reserved : remainingAfter,
      would_exceed: wouldExceed,
      shortfall: wouldExceed ? Math.abs(remainingAfter) : 0,
      buffer_state: state.bufferState,
    })
  } catch (err) {
    console.error('[partner/codes/preview POST] failed', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

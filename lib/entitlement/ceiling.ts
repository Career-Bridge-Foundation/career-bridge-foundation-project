import { supabaseServer } from '@/lib/supabase/server'

export type BufferState = 'ok' | 'warning' | 'at_ceiling' | 'hard_stop'

export type AllocationState = {
  committed: number
  bufferPct: number
  hardCeiling: number      // committed + floor(committed × bufferPct / 100)
  consumed: number         // credits actually activated (negative deltas, reason='activation')
  reserved: number         // sum((max_redemptions - redemptions_used) × credits_per_redemption) for active, non-expired codes
  remaining: number        // hardCeiling - reserved (headroom for new code minting)
  bufferState: BufferState
}

export class CeilingError extends Error {
  constructor(
    public code: 'no_active_allocation' | 'ceiling_exceeded' | 'db_error',
    message: string,
  ) {
    super(message)
    this.name = 'CeilingError'
  }
}

/**
 * Loads the active allocation state for a partner.
 * Active allocation = the row where now() falls between period_start and period_end.
 * Throws CeilingError('no_active_allocation') if none exists.
 *
 * bufferState is based on consumed credits vs committed ceiling:
 *   ok          consumed < 80% of committed
 *   warning     80% <= consumed < 100% of committed
 *   at_ceiling  100% <= consumed < hardCeiling (in the buffer)
 *   hard_stop   consumed >= hardCeiling
 */
export async function getAllocationState(partnerId: string): Promise<AllocationState> {
  const { data: alloc, error: allocErr } = await supabaseServer
    .from('partner_allocations')
    .select('id, committed_credits, buffer_pct')
    .eq('partner_id', partnerId)
    .lte('period_start', new Date().toISOString())
    .gte('period_end', new Date().toISOString())
    .maybeSingle()

  if (allocErr) throw new CeilingError('db_error', allocErr.message)
  if (!alloc) throw new CeilingError('no_active_allocation', 'no active allocation for this partner')

  const committed = alloc.committed_credits as number
  const bufferPct = alloc.buffer_pct as number
  const hardCeiling = committed + Math.floor((committed * bufferPct) / 100)

  // Consumed = credits spent on activations originating from this partner
  const { data: consumedRows, error: consumedErr } = await supabaseServer
    .from('credit_ledger')
    .select('delta')
    .eq('partner_id', partnerId)
    .eq('reason', 'activation')

  if (consumedErr) throw new CeilingError('db_error', consumedErr.message)

  const consumed = (consumedRows ?? []).reduce((sum, r) => sum + Math.abs(r.delta as number), 0)

  // Reserved = remaining UNREDEEMED reserve on active, non-expired,
  // non-revoked codes — Spec 18's data model section: "SUM((max_redemptions
  // - redemption_count) * credits_per_redemption) across status = 'active'
  // codes". Previously summed the FULL credits_per_redemption × max_redemptions
  // for every non-revoked code regardless of how much had already been
  // redeemed, which double-counted already-consumed credits (once here,
  // once in `consumed`) and never released reserve on expiry (edge case:
  // "Code expires with redemptions remaining → Reserve released to ceiling
  // on expiry, not left stranded" — the .gt('expires_at', now) filter below
  // is what makes that true).
  const nowIso = new Date().toISOString()
  const { data: codeRows, error: codeErr } = await supabaseServer
    .from('sponsor_codes')
    .select('credits_per_redemption, max_redemptions, redemptions_used')
    .eq('partner_id', partnerId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)

  if (codeErr) throw new CeilingError('db_error', codeErr.message)

  const reserved = (codeRows ?? []).reduce(
    (sum, r) =>
      sum +
      ((r.max_redemptions as number) - (r.redemptions_used as number)) *
        (r.credits_per_redemption as number),
    0,
  )

  const remaining = hardCeiling - reserved

  let bufferState: BufferState
  if (consumed >= hardCeiling) {
    bufferState = 'hard_stop'
  } else if (consumed >= committed) {
    bufferState = 'at_ceiling'
  } else if (consumed >= Math.floor(committed * 0.8)) {
    bufferState = 'warning'
  } else {
    bufferState = 'ok'
  }

  return { committed, bufferPct, hardCeiling, consumed, reserved, remaining, bufferState }
}

/**
 * Checks whether minting a new code with the given reserved value would exceed
 * the partner's hard ceiling (committed + buffer). Throws CeilingError on breach.
 *
 * Call this before inserting a new sponsor_codes row.
 * reservedValue = credits_per_redemption × max_redemptions of the proposed code.
 */
export async function assertMintWithinCeiling(
  partnerId: string,
  reservedValue: number,
): Promise<AllocationState> {
  const state = await getAllocationState(partnerId)

  if (state.reserved + reservedValue > state.hardCeiling) {
    throw new CeilingError(
      'ceiling_exceeded',
      `minting this code would reserve ${state.reserved + reservedValue} credits against a ceiling of ${state.hardCeiling}`,
    )
  }

  return state
}

/**
 * Checks whether a bulk cohort enrolment requiring totalCreditsNeeded would fit
 * within the ceiling. Throws CeilingError if not — the entire enrolment must be
 * rejected (never partially provisioned). See Spec 15 ceiling enforcement section.
 */
export async function assertCohortEnrolmentWithinCeiling(
  partnerId: string,
  totalCreditsNeeded: number,
): Promise<AllocationState> {
  const state = await getAllocationState(partnerId)

  if (state.reserved + totalCreditsNeeded > state.hardCeiling) {
    throw new CeilingError(
      'ceiling_exceeded',
      `cohort enrolment requires ${totalCreditsNeeded} credits but only ${state.remaining} remain within the ceiling`,
    )
  }

  return state
}

import { supabaseServer } from '@/lib/supabase/server'

export type CreditBalance = {
  total: number
  fungible: number
  cohortScoped: Record<string, number>  // cohort_id → balance (may be negative if overspent)
}

/**
 * Returns the current credit balance for a candidate.
 * Balance = SUM(delta) from credit_ledger — never stored as a mutable column.
 *
 * candidateId is portfolio_profiles.id (not auth.users.id).
 * Uses service-role client; never called from a candidate-authenticated path directly.
 * Throws on DB error — caller maps to 500.
 */
export async function getCandidateBalance(candidateId: string): Promise<CreditBalance> {
  const { data, error } = await supabaseServer
    .from('credit_ledger')
    .select('delta, cohort_id')
    .eq('candidate_id', candidateId)

  if (error) throw new Error(`credit_ledger query failed: ${error.message}`)

  const rows = data ?? []

  let fungible = 0
  const cohortScoped: Record<string, number> = {}

  for (const row of rows) {
    const delta = row.delta as number
    const cohortId = row.cohort_id as string | null

    if (cohortId) {
      cohortScoped[cohortId] = (cohortScoped[cohortId] ?? 0) + delta
    } else {
      fungible += delta
    }
  }

  return {
    total: fungible + Object.values(cohortScoped).reduce((s, v) => s + v, 0),
    fungible,
    cohortScoped,
  }
}

/**
 * Credits the candidate bought themselves (Spec 16) and hasn't spent yet —
 * purchase grants minus activation debits attributed to 'purchase'. Mirrors
 * step 1c of activate_simulation() (schema-reference/spec-20-activate-rpc-
 * sponsored-disciplines.sql): the only credits usable on a discipline the
 * candidate's partner hasn't granted them (Spec 20).
 */
export async function getPurchasedBalance(candidateId: string): Promise<number> {
  const { data, error } = await supabaseServer
    .from('credit_ledger')
    .select('delta, reason, debited_reason')
    .eq('candidate_id', candidateId)
    .is('cohort_id', null)
    .or('reason.eq.purchase,debited_reason.eq.purchase')

  if (error) throw new Error(`credit_ledger query failed: ${error.message}`)

  let left = 0
  for (const row of data ?? []) {
    if (row.reason === 'purchase') left += row.delta as number
    else if (row.reason === 'activation' && row.debited_reason === 'purchase') left += row.delta as number
  }
  return Math.max(left, 0)
}

export type SpendSource =
  | { type: 'cohort'; cohortId: string }
  | { type: 'fungible' }
  | { type: 'insufficient' }

/**
 * Applies the spend rule from Spec 15:
 *   - Activating a scenario inside a cohort's set → spend cohort credit first.
 *   - If cohort credit is exhausted, fall through to fungible.
 *   - Activating outside any cohort → fungible only.
 *   - "Do not block" on fall-through — only return 'insufficient' when both are 0.
 *
 * cohortId is the cohort this simulation belongs to, or null if none.
 */
export function resolveSpendSource(balance: CreditBalance, cohortId: string | null): SpendSource {
  if (cohortId && (balance.cohortScoped[cohortId] ?? 0) > 0) {
    return { type: 'cohort', cohortId }
  }
  if (balance.fungible > 0) {
    return { type: 'fungible' }
  }
  return { type: 'insufficient' }
}

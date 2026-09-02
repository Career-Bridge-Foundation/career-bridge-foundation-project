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

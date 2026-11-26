import { supabaseServer } from '@/lib/supabase/server'

/**
 * Spec 20 — may this candidate spend SPONSORED (sponsor-code) credits on
 * this simulation?
 *
 * Sponsor codes are only redeemable from the candidate's provisioning
 * partner (POST /api/candidate/redeem-code, `wrong_partner`), so those
 * credits only cover disciplines THAT partner has actively granted the
 * candidate. Purchased credits are unaffected — the activate_simulation()
 * RPC still lets them be spent on any simulation.
 *
 * A simulation with no discipline set can't be matched to a grant, so it
 * stays open to sponsored credits (the pre-Spec-20 behaviour).
 *
 * Throws on DB error — caller maps to 500.
 */
export async function canUseSponsoredCredits(
  candidateId: string,
  provisionedByPartner: string,
  simulationId: string,
): Promise<boolean> {
  const { data: sim, error: simErr } = await supabaseServer
    .from('simulations')
    .select('discipline')
    .eq('id', simulationId)
    .maybeSingle()
  if (simErr) throw new Error(`simulations query failed: ${simErr.message}`)
  if (!sim?.discipline) return true

  const { data: ents, error: entErr } = await supabaseServer
    .from('candidate_entitlements')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('granted_by_partner', provisionedByPartner)
    .eq('discipline', sim.discipline)
    .is('revoked_at', null)
    .limit(1)
  if (entErr) throw new Error(`candidate_entitlements query failed: ${entErr.message}`)

  return !!ents?.length
}

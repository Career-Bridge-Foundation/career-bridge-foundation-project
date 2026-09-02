import { supabaseServer } from '@/lib/supabase/server'

export type CandidateAcceptanceStatus = {
  candidateId: string
  platformTermsAccepted: boolean
  programmeTermsAccepted: boolean
}

/**
 * Reads partner_candidate_acceptance_status (supabase/migrations/
 * 20260824_001_candidate_acceptance.sql), a view over candidate_entitlements
 * joined to candidate_terms_acceptances. Uses the service-role client, which
 * bypasses the view's grants entirely — the REVOKE SELECT ... FROM authenticated
 * in migration 003 (a real over-broad-grant bug found in self-review) has no
 * effect here. `partnerId` must be the authenticated partner's own id
 * (requirePartner()'s ctx.partnerId) — this is the sole tenant boundary,
 * there is no RLS backstop, same convention as lib/partners/candidateProgress.ts.
 */
export async function getPartnerCandidateAcceptanceStatus(
  partnerId: string,
  candidateIds: string[],
): Promise<CandidateAcceptanceStatus[]> {
  if (!candidateIds.length) return []

  const { data, error } = await supabaseServer
    .from('partner_candidate_acceptance_status')
    .select('candidate_id, platform_terms_accepted, programme_terms_accepted')
    .eq('partner_id', partnerId)
    .in('candidate_id', candidateIds)

  if (error) throw error

  return (data ?? []).map((row) => ({
    candidateId: row.candidate_id as string,
    platformTermsAccepted: !!row.platform_terms_accepted,
    programmeTermsAccepted: !!row.programme_terms_accepted,
  }))
}

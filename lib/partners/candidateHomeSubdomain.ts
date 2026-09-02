import { supabaseServer } from '@/lib/supabase/server'

/**
 * The logged-in candidate's own partner subdomain, if any — used anywhere a
 * page needs to route a candidate back to their branded subdomain after
 * being forced onto the canonical app.evidentize.io host (currently
 * /portfolio/*, see middleware.ts's canonical-host redirect). Null for an
 * anonymous visitor, a candidate with no partner association, or a partner
 * with no subdomain configured — all of which correctly fall back to the
 * neutral app.evidentize.io experience.
 *
 * Resolves via the candidate's most recently granted active entitlement —
 * a candidate with entitlements from more than one partner is a real but
 * rare edge case; "most recent" is a reasonable default, not a hard
 * product decision.
 */
export async function getCandidateHomeSubdomain(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseServer
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile) return null

  const { data: entitlement } = await supabaseServer
    .from('candidate_entitlements')
    .select('granted_by_partner, granted_at')
    .eq('candidate_id', profile.id)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!entitlement) return null

  const { data: partner } = await supabaseServer
    .from('partners')
    .select('subdomain')
    .eq('id', entitlement.granted_by_partner)
    .maybeSingle()

  return (partner?.subdomain as string | null) ?? null
}

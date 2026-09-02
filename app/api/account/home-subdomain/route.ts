import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/account/home-subdomain — the logged-in candidate's own partner
 * subdomain, if any. Used ONLY by the site Header, and only on pages that
 * force the browser onto the canonical app.evidentize.io host regardless of
 * which subdomain the candidate started on (currently just /portfolio/*,
 * see middleware.ts) — everywhere else, the browser is already on the
 * correct host by virtue of normal navigation, so this is never called.
 *
 * Resolves via the candidate's most recently granted active entitlement —
 * a candidate with entitlements from more than one partner is a real but
 * rare edge case; "most recent" is a reasonable default, not a hard
 * product decision.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ subdomain: null })

  const { data: profile } = await supabaseServer
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ subdomain: null })

  const { data: entitlement } = await supabaseServer
    .from('candidate_entitlements')
    .select('granted_by_partner, granted_at')
    .eq('candidate_id', profile.id)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!entitlement) return NextResponse.json({ subdomain: null })

  const { data: partner } = await supabaseServer
    .from('partners')
    .select('subdomain')
    .eq('id', entitlement.granted_by_partner)
    .maybeSingle()

  return NextResponse.json({ subdomain: (partner?.subdomain as string | null) ?? null })
}

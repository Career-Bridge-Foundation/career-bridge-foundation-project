import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { getCandidateBalance, getPurchasedBalance } from '@/lib/entitlement/balance'
import { canUseSponsoredCredits } from '@/lib/entitlement/sponsoredAccess'
import { CURRENT_TERMS_VERSION } from '@/lib/entitlement/constants'

export const runtime = 'nodejs'

/**
 * GET /api/candidate/entitlement
 *
 * Returns the authenticated candidate's credit balance and terms acceptance
 * status. Used by the Assessment Pack modal to decide which variant to render:
 *   - termsAccepted false  → show full T&C acceptance flow
 *   - termsAccepted true   → show brief confirmation only
 *   - balance.total === 0  → show sponsor code entry (no balance variant)
 *
 * Optional ?simulation_id= (Spec 20): when the candidate's partner hasn't
 * granted them that simulation's discipline, sponsored credits can't be spent
 * on it — `balance` is then only what's left of their PURCHASED credits
 * (mirroring activate_simulation() step 1c), `sponsoredAllowed` is false and
 * `sponsoredHeld` is how many sponsored credits they hold but can't use here.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, provisioned_by_partner')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!portfolio) {
      return NextResponse.json({ error: 'portfolio not found' }, { status: 404 })
    }

    const simulationId = new URL(request.url).searchParams.get('simulation_id')

    const [fullBalance, termsRow] = await Promise.all([
      getCandidateBalance(portfolio.id),
      supabaseServer
        .from('candidate_terms_acceptances')
        .select('id')
        .eq('candidate_id', portfolio.id)
        .eq('document_type', 'platform_terms')
        .is('partner_id', null)
        .eq('version', CURRENT_TERMS_VERSION)
        .maybeSingle(),
    ])

    let balance = fullBalance
    let sponsoredAllowed = true
    let sponsoredHeld = 0
    if (simulationId && portfolio.provisioned_by_partner) {
      sponsoredAllowed = await canUseSponsoredCredits(portfolio.id, portfolio.provisioned_by_partner, simulationId)
      if (!sponsoredAllowed) {
        const purchased = Math.max(Math.min(fullBalance.fungible, await getPurchasedBalance(portfolio.id)), 0)
        balance = { total: purchased, fungible: purchased, cohortScoped: {} }
        sponsoredHeld = Math.max(fullBalance.total - purchased, 0)
      }
    }

    return NextResponse.json({
      balance,
      sponsoredAllowed,
      sponsoredHeld,
      termsAccepted: !!termsRow.data,
      termsVersion: CURRENT_TERMS_VERSION,
    })
  } catch (err) {
    console.error('[candidate/entitlement] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { getCandidateBalance } from '@/lib/entitlement/balance'
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
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!portfolio) {
      return NextResponse.json({ error: 'portfolio not found' }, { status: 404 })
    }

    const [balance, termsRow] = await Promise.all([
      getCandidateBalance(portfolio.id),
      supabaseServer
        .from('terms_acceptances')
        .select('id')
        .eq('candidate_id', portfolio.id)
        .eq('terms_version', CURRENT_TERMS_VERSION)
        .maybeSingle(),
    ])

    return NextResponse.json({
      balance,
      termsAccepted: !!termsRow.data,
      termsVersion: CURRENT_TERMS_VERSION,
    })
  } catch (err) {
    console.error('[candidate/entitlement] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

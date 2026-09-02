import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { getPricingRegion } from '@/lib/entitlement/pricingRegion'
import { PACKS, resolvePackPrice, type Pack } from '@/lib/payments/packs'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * GET /api/candidate/packs
 *
 * Returns Builder/Professional pack options with region-resolved pricing
 * for display. Region is derived server-side only, from the candidate's
 * portfolio_profiles.country — never from the request. Used by
 * AssessmentPackModal's no-balance state to render the "buy credits" picker.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, country, provisioned_by_partner')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!portfolio) {
      return NextResponse.json({ error: 'portfolio not found' }, { status: 404 })
    }

    if (!portfolio.provisioned_by_partner) {
      return NextResponse.json(
        { error: 'candidate is not provisioned by a partner; purchase is unavailable' },
        { status: 422 }
      )
    }

    const region = getPricingRegion(portfolio.country)
    const partnerId = portfolio.provisioned_by_partner as string

    const packs = await Promise.all(
      (Object.keys(PACKS) as Pack[]).map(async (pack) => {
        const resolved = await resolvePackPrice(partnerId, region, pack)
        if (!resolved) return null

        const price = await stripe.prices.retrieve(resolved.stripePriceId)

        return {
          pack,
          label: PACKS[pack].label,
          credits: PACKS[pack].credits,
          amount: price.unit_amount,
          currency: price.currency,
        }
      })
    )

    const available = packs.filter((p): p is NonNullable<typeof p> => p !== null)

    if (available.length === 0) {
      return NextResponse.json(
        { error: `no pack pricing configured for partner ${partnerId} / region ${region}` },
        { status: 422 }
      )
    }

    return NextResponse.json({ region, packs: available })
  } catch (err) {
    console.error('[candidate/packs] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

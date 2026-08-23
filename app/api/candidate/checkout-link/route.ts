import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { getPricingRegion } from '@/lib/entitlement/pricingRegion'
import { PACKS, resolvePackPrice, type Pack } from '@/lib/payments/packs'
import { CURRENT_TERMS_VERSION } from '@/lib/entitlement/constants'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * POST /api/candidate/checkout-link
 *
 * Resolves price server-side from the candidate's derived region + the
 * requested pack, records terms + immediate-performance consent, and
 * creates a Stripe Checkout Session bound to this candidate.
 *
 * Never accepts region, country or price from the request body — only
 * `pack`. See Spec 16 "Decisions locked" #3.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: {
      pack?: Pack
      terms_accepted?: boolean
      immediate_performance_consent?: boolean
      simulation_id?: string
      cohort_id?: string | null
      return_to?: string | null
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { pack, terms_accepted, immediate_performance_consent, simulation_id, cohort_id, return_to } = body

    if (!pack || !(pack in PACKS)) {
      return NextResponse.json({ error: 'Invalid or missing pack' }, { status: 400 })
    }
    if (!terms_accepted || !immediate_performance_consent) {
      return NextResponse.json(
        { error: 'terms_accepted and immediate_performance_consent are required' },
        { status: 400 }
      )
    }
    if (typeof simulation_id !== 'string' || !simulation_id) {
      return NextResponse.json({ error: 'simulation_id required' }, { status: 400 })
    }
    // return_to must be a same-origin relative path — never a full URL — to
    // avoid the return page redirecting a candidate off-platform post-payment.
    const safeReturnTo =
      typeof return_to === 'string' && return_to.startsWith('/') && !return_to.startsWith('//')
        ? return_to
        : '/'

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

    const candidateId = portfolio.id as string
    const partnerId   = portfolio.provisioned_by_partner as string
    const region       = getPricingRegion(portfolio.country)

    const resolved = await resolvePackPrice(partnerId, region, pack)
    if (!resolved) {
      return NextResponse.json(
        { error: `no pack pricing configured for partner ${partnerId} / region ${region}` },
        { status: 422 }
      )
    }

    const { data: partnerConfig } = await supabaseServer
      .from('partner_stripe_config')
      .select('return_url')
      .eq('partner_id', partnerId)
      .maybeSingle()

    if (!partnerConfig) {
      return NextResponse.json(
        { error: `no Stripe configuration for partner ${partnerId}` },
        { status: 422 }
      )
    }

    // Consent must be recorded before the payment redirect — the UK
    // distance-selling position requires legal commitment before financial.
    // Skip if this candidate already has a row for the current version
    // (matches the dedup logic in the Spec 15 activate_simulation RPC).
    // Written to candidate_terms_acceptances (Spec 19 shape — see
    // schema-reference/spec-19-terms-acceptance-shape.sql), not the older
    // terms_acceptances table.
    const { data: existingTerms } = await supabaseServer
      .from('candidate_terms_acceptances')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('document_type', 'platform_terms')
      .is('partner_id', null)
      .eq('version', CURRENT_TERMS_VERSION)
      .maybeSingle()

    if (!existingTerms) {
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const userAgent = request.headers.get('user-agent') ?? null
      const { error: termsError } = await supabaseServer.from('candidate_terms_acceptances').insert({
        candidate_id: candidateId,
        document_type: 'platform_terms',
        partner_id: null,
        version: CURRENT_TERMS_VERSION,
        ip_address: ipAddress,
        user_agent: userAgent,
        immediate_performance_consent: true,
      })
      if (termsError) {
        console.error('[candidate/checkout-link] candidate_terms_acceptances insert failed', termsError)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
      }
    }

    const returnBase = partnerConfig.return_url as string
    const returnParams = new URLSearchParams({
      simulation_id: simulation_id,
      return_to: safeReturnTo,
      ...(cohort_id ? { cohort_id } : {}),
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: resolved.stripePriceId, quantity: 1 }],
      client_reference_id: candidateId,
      metadata: { partner_id: partnerId, pack, pricing_region: region, candidate_id: candidateId },
      success_url: `${returnBase}?${returnParams.toString()}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.headers.get('referer') ?? returnBase,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 })
    }

    // Structured event for the launch-required metrics (Spec 16 "Metrics
    // required from launch") — checkout starts, by country/pack/region.
    console.log('[metrics] checkout_started', JSON.stringify({
      candidate_id: candidateId,
      partner_id: partnerId,
      pack,
      pricing_region: region,
      country: portfolio.country ?? null,
    }))

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[candidate/checkout-link] unexpected error', err)
    return NextResponse.json({ error: 'Checkout session creation failed', details: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseServer } from '@/lib/supabase/server'
import { getPricingRegion, type PricingRegion } from '@/lib/entitlement/pricingRegion'
import { PACKS, type Pack } from '@/lib/payments/packs'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// pack_transactions and credit_ledger are written as two separate inserts,
// not a single RPC transaction (see CLAUDE.md "Database-touching code").
// Order matters: pack_transactions is written FIRST because
// credit_ledger.source_transaction_id has a real FK to it. If the
// credit_ledger insert below fails after pack_transactions succeeds, the
// candidate has a transaction row but no minted credits — this is the gap
// the spec's "reconciliation job / manual credit path for support" edge
// case exists for; it is not closed by this route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await params
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  const { data: partnerConfig } = await supabaseServer
    .from('partner_stripe_config')
    .select('webhook_signing_secret')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (!partnerConfig) {
    console.error(`[webhooks/stripe] no partner_stripe_config for partner ${partnerId}`)
    return NextResponse.json({ error: 'Unknown partner' }, { status: 404 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, partnerConfig.webhook_signing_secret as string)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhooks/stripe] signature verification failed:', message)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Identity via client_reference_id ONLY — never match on email. Candidates
  // commonly pay with a different email from their account (Spec 16 §
  // "Webhook handler — security-critical").
  const candidateId = session.client_reference_id
  if (!candidateId) {
    console.error(`[webhooks/stripe] checkout.session.completed with no client_reference_id — session ${session.id}`)
    // 200 so Stripe doesn't retry an event that will never gain an ID; flagged for manual reconciliation.
    return NextResponse.json({ received: true, warning: 'no client_reference_id' })
  }

  const pack = session.metadata?.pack as Pack | undefined
  const checkoutRegion = session.metadata?.pricing_region as PricingRegion | undefined
  const metadataPartnerId = session.metadata?.partner_id

  if (!pack || !(pack in PACKS) || !checkoutRegion) {
    console.error(`[webhooks/stripe] checkout.session.completed missing pack/region metadata — session ${session.id}`)
    return NextResponse.json({ received: true, warning: 'missing pack/region metadata' })
  }
  if (metadataPartnerId && metadataPartnerId !== partnerId) {
    console.error(`[webhooks/stripe] partner mismatch — URL ${partnerId}, metadata ${metadataPartnerId}, session ${session.id}`)
  }

  // Region cross-check: compare the region priced at checkout time against
  // the candidate's CURRENT derived region. Mismatch is logged and flagged
  // on the row, but credits are minted regardless — never strand a
  // candidate who has paid. A mismatch is the signal a checkout URL was
  // shared outside its intended region.
  const { data: portfolio } = await supabaseServer
    .from('portfolio_profiles')
    .select('country')
    .eq('id', candidateId)
    .maybeSingle()

  const currentRegion = getPricingRegion(portfolio?.country ?? null)
  const regionMismatch = currentRegion !== checkoutRegion
  if (regionMismatch) {
    // Structured event for the launch-required metrics (Spec 16 "Metrics
    // required from launch") — this is the signal a checkout URL was shared
    // outside its intended region.
    console.warn('[metrics] region_mismatch', JSON.stringify({
      candidate_id: candidateId,
      partner_id: partnerId,
      checkout_region: checkoutRegion,
      current_region: currentRegion,
      session_id: session.id,
    }))
  }

  // stripe_fee / fx_cost are not present on checkout.session.completed —
  // best-effort fetch from the balance transaction. Never block minting on
  // this failing; a reconciliation job can backfill these fields later.
  let stripeFee: number | null = null
  let fxCost: number | null = null
  let netReceived: number | null = null
  let settlementCurrency: string | null = null
  let settlementAmount: number | null = null

  try {
    if (typeof session.payment_intent === 'string') {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ['latest_charge.balance_transaction'],
      })
      const charge = paymentIntent.latest_charge
      const balanceTransaction =
        typeof charge === 'object' && charge && typeof charge.balance_transaction === 'object'
          ? charge.balance_transaction
          : null

      if (balanceTransaction) {
        netReceived = balanceTransaction.net
        settlementCurrency = balanceTransaction.currency
        settlementAmount = balanceTransaction.amount
        stripeFee =
          balanceTransaction.fee_details
            ?.filter((f) => f.type === 'stripe_fee')
            .reduce((sum, f) => sum + f.amount, 0) ?? balanceTransaction.fee
        fxCost =
          balanceTransaction.fee_details
            ?.filter((f) => f.type === 'foreign_exchange_fee' || f.type === 'tax')
            .reduce((sum, f) => sum + f.amount, 0) ?? 0
      }
    }
  } catch (err) {
    console.error(`[webhooks/stripe] balance transaction fetch failed for session ${session.id}`, err)
  }

  try {
    let transactionId: string

    const { data: transaction, error: insertError } = await supabaseServer
      .from('pack_transactions')
      .insert({
        candidate_id: candidateId,
        partner_id: partnerId,
        pricing_region: checkoutRegion,
        pack,
        credits_purchased: PACKS[pack].credits,
        stripe_event_id: event.id,
        stripe_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        presentment_currency: session.currency ?? 'gbp',
        gross_amount: session.amount_total ?? 0,
        settlement_currency: settlementCurrency,
        settlement_amount: settlementAmount,
        stripe_fee: stripeFee,
        fx_cost: fxCost,
        net_received: netReceived,
        region_mismatch: regionMismatch,
      })
      .select('id')
      .single()

    if (insertError) {
      // Unique violation on stripe_event_id = Stripe retry of an event we've
      // seen before. Look up the existing row rather than no-op immediately —
      // if the credit_ledger insert below failed on a prior attempt, this
      // retry is how it gets completed instead of permanently stranding the
      // candidate's credits.
      if (insertError.code === '23505') {
        const { data: existing } = await supabaseServer
          .from('pack_transactions')
          .select('id')
          .eq('stripe_event_id', event.id)
          .single()
        if (!existing) {
          console.error(`[webhooks/stripe] unique violation but row not found for event ${event.id}`)
          return NextResponse.json({ error: 'Database read failed' }, { status: 500 })
        }
        transactionId = existing.id
      } else {
        console.error(`[webhooks/stripe] pack_transactions insert failed for session ${session.id}`, insertError)
        return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
      }
    } else {
      transactionId = transaction.id
    }

    const { data: existingLedgerRow } = await supabaseServer
      .from('credit_ledger')
      .select('id')
      .eq('source_transaction_id', transactionId)
      .maybeSingle()

    if (existingLedgerRow) {
      return NextResponse.json({ received: true, note: 'already processed' })
    }

    const { error: ledgerError } = await supabaseServer.from('credit_ledger').insert({
      candidate_id: candidateId,
      partner_id: partnerId,
      cohort_id: null,
      delta: PACKS[pack].credits,
      reason: 'purchase',
      source_transaction_id: transactionId,
    })

    if (ledgerError) {
      console.error(
        `[webhooks/stripe] credit_ledger insert failed after pack_transactions ${transactionId} — candidate ${candidateId} needs manual credit`,
        ledgerError
      )
      return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
    }

    // Structured event for the launch-required metrics (Spec 16 "Metrics
    // required from launch") — successful transactions, pack mix, fees/FX,
    // by country.
    console.log('[metrics] purchase_completed', JSON.stringify({
      candidate_id: candidateId,
      partner_id: partnerId,
      pack,
      pricing_region: checkoutRegion,
      country: portfolio?.country ?? null,
      region_mismatch: regionMismatch,
      gross_amount: session.amount_total ?? 0,
      currency: session.currency ?? 'gbp',
      stripe_fee: stripeFee,
      fx_cost: fxCost,
      net_received: netReceived,
    }))
  } catch (err) {
    console.error(`[webhooks/stripe] unexpected error for session ${session.id}`, err)
    return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

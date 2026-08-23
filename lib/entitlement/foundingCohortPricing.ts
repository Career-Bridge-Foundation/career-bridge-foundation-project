import type { PricingRegion } from './pricingRegion'

// Reference-only figures for the partner-facing inline pricing preview on
// the invite mint form (Amendment §Console UI — "Nigeria — Africa Access
// pricing, $14.99 per credit, shown in NGN"). NOT the source of truth for
// actual billing — that's Stripe, via partner_pack_prices
// (lib/payments/packs.ts resolvePackPrice()). Update this alongside any
// change to the founding cohort price table / when a new Stripe Price
// version is minted.
export const FOUNDING_COHORT_PER_CREDIT: Record<PricingRegion, number> = {
  STANDARD: 29.99,
  AFRICA_ACCESS: 14.99,
  SPONSORED: 0,
  PARTNER_SPECIFIC: 0,
}

export const PRICING_REGION_LABEL: Record<PricingRegion, string> = {
  STANDARD: 'Standard',
  AFRICA_ACCESS: 'Africa Access',
  SPONSORED: 'Sponsored',
  PARTNER_SPECIFIC: 'Partner-specific',
}

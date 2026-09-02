export type PricingRegion = 'STANDARD' | 'AFRICA_ACCESS' | 'SPONSORED' | 'PARTNER_SPECIFIC'

// Countries mapped to AFRICA_ACCESS pricing tier.
// All other countries default to STANDARD.
// To add a market: add the ISO 3166-1 alpha-2 code here — no migration needed.
// SPONSORED and PARTNER_SPECIFIC are partner-negotiated and set at the partner level (Spec 16).
const AFRICA_ACCESS_COUNTRIES = new Set([
  'NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'ET', 'SN',
  'CM', 'ZW', 'ZM', 'MW', 'MZ', 'AO', 'CI', 'BJ', 'TG',
  'BF', 'ML', 'GN', 'SL', 'LR', 'GM', 'ER', 'DJ', 'SO',
  'SD', 'SS', 'CD', 'CG', 'GA', 'GQ', 'CF', 'TD', 'NE',
  'NA', 'BW', 'LS', 'SZ', 'MG', 'MU', 'SC', 'KM', 'CV',
  'ST',
])

/**
 * Derives a candidate's pricing region from their stored country code.
 * Country is captured by the partner at invite (portfolio_profiles.country).
 *
 * IMPORTANT — prohibited inputs: never pass IP address, browser locale,
 * timezone, or any request-derived value. Country must come exclusively
 * from portfolio_profiles.country (partner-set). See Spec 15 Decision 14.
 */
export function getPricingRegion(country: string | null | undefined): PricingRegion {
  if (!country) return 'STANDARD'
  return AFRICA_ACCESS_COUNTRIES.has(country.toUpperCase()) ? 'AFRICA_ACCESS' : 'STANDARD'
}

// Country → presentment currency, per the country-and-pricing amendment.
// Config, not code — adding a country here is a data change, no migration.
// Unmapped countries fall back to the base currency (GBP — Career Bridge
// Foundation's settlement currency). This is the display/target currency;
// wiring it into Stripe Checkout as an explicit currency_options selection
// happens once the underlying Price objects are configured for it (see
// schema-reference/spec-16-candidate-purchase.sql and the Stripe setup guide).
const COUNTRY_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  NG: 'NGN',
  GH: 'GHS',
  RW: 'RWF',
}

const BASE_CURRENCY = 'GBP'

/**
 * Derives a candidate's presentment currency from their stored country code.
 * Same prohibited-inputs rule as getPricingRegion — never derive from IP,
 * locale, timezone or any request-derived value (Amendment: "this amendment
 * extends the same rule to presentment").
 */
export function getPresentmentCurrency(country: string | null | undefined): string {
  if (!country) return BASE_CURRENCY
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? BASE_CURRENCY
}

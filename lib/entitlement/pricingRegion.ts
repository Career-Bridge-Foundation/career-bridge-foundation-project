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

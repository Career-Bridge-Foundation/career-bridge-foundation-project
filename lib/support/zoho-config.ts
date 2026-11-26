import 'server-only'

// Zoho Desk credentials are shared with the standalone ticketing app
// (ticketing-cb) and tied to one Zoho agent's account. If the refresh token is
// replaced or revoked, BOTH apps' env vars must be updated.

export type ZohoConfig = {
  dc: string
  clientId: string
  clientSecret: string
  refreshToken: string
  orgId: string
  departmentId: string
  sourceField: string
}

const REQUIRED = [
  'ZOHO_DC',
  'ZOHO_CLIENT_ID',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REFRESH_TOKEN',
  'ZOHO_ORG_ID',
  'ZOHO_TECH_DEPARTMENT_ID',
  'ZOHO_SOURCE_FIELD',
] as const

let cachedConfig: ZohoConfig | null = null

/**
 * Validated on first use (not at import) so a missing var only breaks the
 * support endpoint, never the build or unrelated routes. The error names the
 * missing variables but never includes any values.
 */
export function getZohoConfig(): ZohoConfig {
  if (cachedConfig) return cachedConfig

  const missing = REQUIRED.filter((name) => !process.env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`Zoho Desk is not configured: missing env var(s) ${missing.join(', ')}`)
  }

  const dc = process.env.ZOHO_DC!.trim()
  // Interpolated into hostnames (accounts.zoho.<dc>, desk.zoho.<dc>), so only
  // allow plain domain suffixes like "eu", "com", "com.au".
  if (!/^[a-z]{2,4}(\.[a-z]{2,4})?$/.test(dc)) {
    throw new Error('Zoho Desk is not configured: ZOHO_DC is not a valid data-centre suffix')
  }

  cachedConfig = {
    dc,
    clientId: process.env.ZOHO_CLIENT_ID!.trim(),
    clientSecret: process.env.ZOHO_CLIENT_SECRET!.trim(),
    refreshToken: process.env.ZOHO_REFRESH_TOKEN!.trim(),
    orgId: process.env.ZOHO_ORG_ID!.trim(),
    departmentId: process.env.ZOHO_TECH_DEPARTMENT_ID!.trim(),
    sourceField: process.env.ZOHO_SOURCE_FIELD!.trim(),
  }
  return cachedConfig
}

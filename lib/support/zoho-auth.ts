import 'server-only'
import { getZohoConfig } from './zoho-config'

// Access token cached in module memory until ~5 min before expiry. Zoho
// rate-limits token generation, so never fetch one per request. Concurrent
// callers share a single in-flight refresh. (Each serverless instance keeps
// its own cache; that's fine, it's one refresh per instance per hour.)

let cached: { value: string; expiresAt: number } | null = null
let inflight: Promise<string> | null = null

export function clearAccessToken() {
  cached = null
}

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 5 * 60_000) return cached.value
  inflight ??= refresh().finally(() => {
    inflight = null
  })
  return inflight
}

async function refresh(): Promise<string> {
  const cfg = getZohoConfig()
  const res = await fetch(`https://accounts.zoho.${cfg.dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  // Zoho returns HTTP 200 with { error } on bad credentials, so check the
  // body for access_token rather than trusting the status alone.
  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string }
    | null
  if (!res.ok || !data?.access_token) {
    throw new Error(`Zoho token refresh failed: ${data?.error ?? `HTTP ${res.status}`}`)
  }

  cached = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return cached.value
}

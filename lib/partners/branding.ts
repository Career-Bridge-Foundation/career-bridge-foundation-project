/**
 * Edge-safe partner branding resolver for Spec 05.4 Phase 1.
 *
 * Presentation-only. Reads partner branding by subdomain from the public,
 * anon-readable view `partner_public_branding` (approved partners only). The
 * view is exposed to the anon role, so NO service-role key touches the Edge
 * bundle. NEVER throws — every failure path returns null so the caller falls
 * through to neutral branding.
 *
 * This module does not gate access. Branding ≠ authorisation.
 */

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'evidentize.io'

export type PartnerBranding = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
}

// Best-effort in-memory cache (per warm Edge invocation). TTL keeps branding
// edits propagating within a minute without a DB hit on every request.
const TTL_MS = 60_000
const cache = new Map<string, { value: PartnerBranding | null; at: number }>()

/**
 * Extract the partner subdomain from a host header, or null for the apex,
 * www, preview deploys, localhost without a partner label, or custom domains
 * (full custom domains are out of MVP scope).
 */
export function subdomainFromHost(host: string | null): string | null {
  if (!host) return null
  const hostname = host.split(':')[0].toLowerCase().trim() // strip port

  // Local dev support: careerbridge.localhost
  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length)
    return label || null
  }

  // Only the wildcard root is in scope; anything else → neutral.
  if (hostname === ROOT_DOMAIN) return null            // apex
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null // custom domain / vercel.app / etc.

  const label = hostname.slice(0, -(`.${ROOT_DOMAIN}`.length))
  if (!label || label === 'www') return null
  if (label.includes('.')) return null // e.g. multi-level → neutral for MVP
  return label
}

export async function resolvePartnerBranding(
  subdomain: string,
): Promise<PartnerBranding | null> {
  const hit = cache.get(subdomain)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  try {
    const res = await fetch(
      `${url}/rest/v1/partner_public_branding?subdomain=eq.${encodeURIComponent(subdomain)}` +
        `&select=id,name,logo_url,primary_color,secondary_color&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // Don't let a slow DB stall every page; fail to neutral.
        signal: AbortSignal.timeout(2000),
      },
    )
    if (!res.ok) { cache.set(subdomain, { value: null, at: Date.now() }); return null }
    const rows = (await res.json()) as PartnerBranding[]
    const value = rows[0] ?? null
    cache.set(subdomain, { value, at: Date.now() })
    return value
  } catch {
    return null // network error, timeout, bad JSON — neutral.
  }
}

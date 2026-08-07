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

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'evidentize.io'

// Labels that must never resolve to a partner, even if one somehow ended up
// with this value in the DB — infra/product subdomains and DNS-record labels
// already in use (see supabase/email-templates and the MX setup for
// email./send.email.evidentize.io) take precedence over any partner.
export const RESERVED_SUBDOMAINS = new Set([
  'app', 'www', 'api', 'admin', 'mail', 'email', 'send', 'ftp',
  'staging', 'dev', 'test', 'blog', 'docs', 'status', 'support',
  'help', 'cdn', 'static', 'assets', 'ns1', 'ns2',
])

export type PartnerBranding = {
  id: string
  name: string
  logo_url_icon: string | null
  logo_url_on_light: string | null
  logo_url_on_dark: string | null
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
  if (!label || RESERVED_SUBDOMAINS.has(label)) return null
  if (label.includes('.')) return null // e.g. multi-level → neutral for MVP
  return label
}

// Standard DNS label rules: lowercase letters/digits, optional internal
// hyphens, 1-63 chars, no leading/trailing hyphen.
const SUBDOMAIN_FORMAT = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function isValidSubdomainFormat(s: string): boolean {
  return SUBDOMAIN_FORMAT.test(s)
}

/**
 * Builds the URL a partner-scoped link (invite, redemption, notification)
 * should point at: the partner's own subdomain when they have one assigned,
 * falling back to the main app URL otherwise. Centralised so every caller
 * (mint.ts, invite routes, mentor notifications) stays consistent.
 */
export function partnerAppUrl(subdomain: string | null | undefined, fallbackAppUrl: string): string {
  return subdomain ? `https://${subdomain}.${ROOT_DOMAIN}` : fallbackAppUrl
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
        `&select=id,name,logo_url_icon,logo_url_on_light,logo_url_on_dark,primary_color,secondary_color&limit=1`,
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

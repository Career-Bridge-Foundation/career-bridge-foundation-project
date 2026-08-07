import { headers } from 'next/headers'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import type { PartnerBranding } from '@/lib/partners/branding'
import { BrandingProvider } from '@/components/branding/BrandingProvider'

// Reading request headers opts this segment into dynamic rendering; declare it
// explicitly to match the codebase pattern for header-dependent segments
// (e.g. app/admin/layout.tsx, app/partner/page.tsx).
export const dynamic = 'force-dynamic'

/**
 * Overrides <title>/OG/Twitter text with the partner's name on a resolved
 * subdomain (Spec 05.4). Reads the same x-partner-name header the component
 * below reads — no extra DB call. Returns {} (no override) on the apex
 * domain or an unresolved subdomain, so app/layout.tsx's neutral defaults
 * apply unchanged — Next merges child generateMetadata over parent metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const partnerName = h.get('x-partner-name')
  if (!partnerName) return {}

  const title = `${partnerName} | Practice into proof. Proof into portfolio.`
  return {
    applicationName: partnerName,
    title,
    openGraph: { title, siteName: partnerName },
    twitter: { title },
  }
}

/**
 * (branded) route-group layout — Spec 05.4 Phase 2a.
 *
 * Reads the x-partner-* headers (resolved by the Phase 1 middleware; no DB call
 * here) and:
 *  - provides the partner branding to client components via <BrandingProvider>
 *  - overrides the brand CSS custom properties (--color-navy / --color-teal) on
 *    a root <div> so every Tailwind brand utility underneath re-themes with zero
 *    per-component edits. Vars are set ONLY when present, so a neutral request
 *    (apex / unknown subdomain) keeps the global @theme defaults.
 *
 * Presentation only — branding never gates access.
 */
export default async function BrandedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()

  const partnerId = h.get('x-partner-id')

  // No partner header → neutral. Everything stays at the global @theme default.
  const branding: PartnerBranding | null = partnerId
    ? {
        id: partnerId,
        name: h.get('x-partner-name') ?? '',
        logo_url_icon: h.get('x-partner-logo-icon'),
        logo_url_on_light: h.get('x-partner-logo-light'),
        logo_url_on_dark: h.get('x-partner-logo-dark'),
        primary_color: h.get('x-partner-primary'),
        secondary_color: h.get('x-partner-secondary'),
      }
    : null

  // Build the CSS-var override, omitting any var we don't have a value for so
  // the global @theme default applies for that token (neutral fallback).
  const brandVars: Record<string, string> = {}
  if (branding?.primary_color) brandVars['--color-navy'] = branding.primary_color
  if (branding?.secondary_color) brandVars['--color-teal'] = branding.secondary_color

  return (
    <BrandingProvider value={branding}>
      <div style={brandVars as CSSProperties}>{children}</div>
    </BrandingProvider>
  )
}

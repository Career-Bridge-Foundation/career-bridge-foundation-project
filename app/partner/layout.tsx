import { headers } from 'next/headers'
import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { PartnerBranding } from '@/lib/partners/branding'
import { BrandingProvider } from '@/components/branding/BrandingProvider'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Only Candidates is live this slice; the rest are visible-but-stubbed.
const NAV: { label: string; href?: string; live: boolean }[] = [
  { label: 'Candidates', href: '/partner', live: true },
  { label: 'Analytics', live: false },
  { label: 'Team', live: false },
  { label: 'Branding', live: false },
  { label: 'Usage', live: false },
]

export default async function PartnerConsoleLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole console (each section also guards, but fail fast here).
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner')
  }

  // Partner name for the header, by authenticated id (reliable on any host).
  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name')
    .eq('id', ctx.partnerId)
    .maybeSingle()

  // Branding CSS vars from the Phase-1 middleware headers (subdomain-resolved),
  // mirroring app/(branded)/layout.tsx. Neutral CB defaults when absent.
  const h = await headers()
  const partnerId = h.get('x-partner-id')
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
  const brandVars: Record<string, string> = {}
  if (branding?.primary_color) brandVars['--color-navy'] = branding.primary_color
  if (branding?.secondary_color) brandVars['--color-teal'] = branding.secondary_color

  return (
    <BrandingProvider value={branding}>
      <div style={brandVars as CSSProperties} className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
          <aside className="w-64 shrink-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Partner Console</p>
            <h2 className="mb-6 text-lg font-bold leading-snug text-navy break-words">{partner?.name ?? 'Partner'}</h2>
            <nav className="space-y-1">
              {NAV.map((item) =>
                item.live ? (
                  <Link
                    key={item.label}
                    href={item.href!}
                    className="block rounded-md bg-navy px-3 py-2 text-sm font-medium text-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    key={item.label}
                    aria-disabled="true"
                    className="flex cursor-not-allowed select-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-400"
                  >
                    {item.label}
                    <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      Soon
                    </span>
                  </span>
                )
              )}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </BrandingProvider>
  )
}

import { headers } from 'next/headers'
import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import type { PartnerBranding } from '@/lib/partners/branding'
import { BrandingProvider } from '@/components/branding/BrandingProvider'
import { requireMentor } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { MentorNav } from './_mentor-nav'

export const dynamic = 'force-dynamic'

export default async function MentorConsoleLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole console (the dashboard also guards, but fail fast here).
  let ctx
  try {
    ctx = await requireMentor()
  } catch {
    redirect('/auth/login?next=/mentor')
  }

  // The mentor's partner name for the header.
  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name')
    .eq('id', ctx.partnerId)
    .maybeSingle()

  // Branding CSS vars from the Phase-1 middleware headers (subdomain-resolved),
  // mirroring app/partner/layout.tsx. Neutral CB defaults when absent.
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Mentor Console</p>
            <h2 className="mb-6 text-lg font-bold leading-snug text-navy break-words">{partner?.name ?? 'Mentor'}</h2>
            <MentorNav />
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </BrandingProvider>
  )
}

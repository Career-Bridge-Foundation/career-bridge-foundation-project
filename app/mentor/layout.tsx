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

  // Branding by authenticated partnerId — reliable regardless of which host
  // the mentor logs in through. Previously this read the x-partner-* headers,
  // which only resolve on the partner's own subdomain host (see the identical
  // fix and rationale in app/partner/layout.tsx).
  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name, primary_color, secondary_color, logo_url_icon, logo_url_on_light, logo_url_on_dark')
    .eq('id', ctx.partnerId)
    .maybeSingle()

  const branding: PartnerBranding | null = partner
    ? {
        id: ctx.partnerId!,
        name: partner.name ?? '',
        logo_url_icon: partner.logo_url_icon,
        logo_url_on_light: partner.logo_url_on_light,
        logo_url_on_dark: partner.logo_url_on_dark,
        primary_color: partner.primary_color,
        secondary_color: partner.secondary_color,
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
            {branding?.logo_url_icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url_icon}
                alt={branding.name}
                className="mb-4 h-8 w-8 rounded object-contain"
              />
            )}
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

import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { BrandingForm } from './_branding-form'
import { LogoUploader } from './_logo-uploader'

export const dynamic = 'force-dynamic'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'evidentize.io'

export default async function PartnerBrandingPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/branding')
  }

  const { data: partner } = await supabaseServer
    .from('partners')
    .select('primary_color, secondary_color, subdomain, logo_url_icon, logo_url_on_light, logo_url_on_dark')
    .eq('id', ctx.partnerId)
    .maybeSingle()

  const subdomain = (partner?.subdomain as string | null) ?? null
  const brandedUrl = subdomain ? `${subdomain}.${ROOT_DOMAIN}` : null

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Branding</p>
        <h1 className="text-2xl font-bold text-navy">Brand colours</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set the colours used across your branded candidate pages and this console.
        </p>
      </header>

      <BrandingForm
        initialPrimary={(partner?.primary_color as string | null) ?? ''}
        initialSecondary={(partner?.secondary_color as string | null) ?? null}
        brandedUrl={brandedUrl}
      />

      <section className="max-w-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Logos</h2>
          <p className="mt-1 text-sm text-slate-600">
            PNG, JPEG, or WebP, up to 2 MB. Changes can take up to a minute to appear on your branded pages.
          </p>
        </div>
        <LogoUploader
          slot="on_light"
          label="Horizontal logo — light backgrounds"
          description="Shown in the header and on your branded pages."
          initialUrl={(partner?.logo_url_on_light as string | null) ?? null}
        />
        <LogoUploader
          slot="on_dark"
          label="Horizontal logo — dark backgrounds"
          description="Shown in the footer and dark headers."
          initialUrl={(partner?.logo_url_on_dark as string | null) ?? null}
          dark
        />
        <LogoUploader
          slot="icon"
          label="Square icon"
          description="Compact contexts, e.g. the simulation runner."
          initialUrl={(partner?.logo_url_icon as string | null) ?? null}
        />
      </section>
    </div>
  )
}

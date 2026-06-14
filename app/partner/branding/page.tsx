import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { BrandingForm } from './_branding-form'

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
    .select('primary_color, secondary_color, subdomain')
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
    </div>
  )
}

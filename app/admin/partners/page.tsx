import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { ROOT_DOMAIN } from '@/lib/partners/branding'
import { PartnerInviteForm } from './_partner-invite-form'
import { SubdomainEditor } from './_subdomain-editor'
import { SenderEditor } from './_sender-editor'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  suspended: 'bg-red-50 border-red-200 text-red-700',
}

export default async function PartnersPage() {
  // Super-admin only — partner-role grants access to an org's entire
  // candidate dataset, so bootstrapping a new org is a high-privilege op.
  await requireSuperAdmin()

  const { data: partners } = await supabaseServer
    .from('partners')
    .select('id, name, slug, status, contact_email, subdomain, email_sender_name, email_sender_domain, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partners</h1>
        <p className="text-sm mt-1 text-slate-600">
          Create partner organisations and invite their first admin.
        </p>
      </div>

      <PartnerInviteForm />

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Organisations ({partners?.length ?? 0})
          </h2>
        </div>
        {!partners || partners.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No partner organisations yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {partners.map(partner => (
              <div key={partner.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{partner.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {partner.slug} · {partner.contact_email}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-4">
                  <SenderEditor
                    partnerId={partner.id}
                    initialSenderName={(partner.email_sender_name as string | null) ?? null}
                    initialSenderDomain={(partner.email_sender_domain as string | null) ?? null}
                  />
                  <SubdomainEditor
                    partnerId={partner.id}
                    initialSubdomain={(partner.subdomain as string | null) ?? null}
                    rootDomain={ROOT_DOMAIN}
                  />
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full border ${
                      STATUS_STYLE[partner.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {partner.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

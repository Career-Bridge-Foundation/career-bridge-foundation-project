'use client'
import { useState } from 'react'
import { PartnerInviteForm } from './_partner-invite-form'
import { TermsManager } from './_terms-manager'
import type { TermsDoc } from './_version-history'

type Partner = {
  id: string
  name: string
  slug: string
  status: string
  contact_email: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  suspended: 'bg-red-50 border-red-200 text-red-700',
}

type TabKey = 'organisations' | 'terms'

/**
 * Platform terms are a partner-adjacent super-admin concern (this IS
 * partner-neutral, but it's the one document type only super-admin ever
 * touches), so it stays a tab here. Programme terms and community config
 * both moved to the partner's own dashboard — a partner authors and owns
 * both now, not super-admin on their behalf.
 */
export function PartnersTabs({ partners, termsDocs }: { partners: Partner[]; termsDocs: TermsDoc[] }) {
  const [tab, setTab] = useState<TabKey>('organisations')

  function tabClass(key: TabKey) {
    return `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      tab === key ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'
    }`
  }

  return (
    <div>
      <div className="mb-6 inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => setTab('organisations')} className={tabClass('organisations')}>
          Organisations ({partners.length})
        </button>
        <button type="button" onClick={() => setTab('terms')} className={tabClass('terms')}>
          Terms
        </button>
      </div>

      {tab === 'organisations' && (
        <div className="space-y-6">
          <PartnerInviteForm />

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Organisations ({partners.length})</h2>
            </div>
            {partners.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No partner organisations yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {partners.map((partner) => (
                  <div key={partner.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{partner.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {partner.slug} · {partner.contact_email}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 ml-4 text-xs font-medium px-2 py-1 rounded-full border ${
                        STATUS_STYLE[partner.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {partner.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'terms' && <TermsManager docs={termsDocs} />}
    </div>
  )
}

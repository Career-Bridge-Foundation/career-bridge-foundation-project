'use client'
import { useState } from 'react'
import { PartnerInviteForm } from './_partner-invite-form'
import { PartnerRow } from './_partner-row'
import { TermsManager } from './_terms-manager'
import type { TermsDoc } from './_version-history'

type Partner = {
  id: string
  name: string
  slug: string
  status: string
  contact_email: string
  subdomain: string | null
  email_sender_name: string | null
  email_sender_domain: string | null
  created_at: string
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
                  <PartnerRow key={partner.id} partner={partner} />
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

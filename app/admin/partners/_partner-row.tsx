'use client'
import { useState } from 'react'
import { ROOT_DOMAIN } from '@/lib/partners/branding'
import { SenderEditor } from './_sender-editor'
import { SubdomainEditor } from './_subdomain-editor'
import { AllocationEditor } from './_allocation-editor'

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

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  suspended: 'bg-red-50 border-red-200 text-red-700',
}

type DetailTab = 'sender' | 'subdomain' | 'allocation'

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'sender', label: 'Email sender' },
  { key: 'subdomain', label: 'Subdomain' },
  { key: 'allocation', label: 'Credit allocation' },
]

export function PartnerRow({ partner }: { partner: Partner }) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<DetailTab>('sender')

  return (
    <div>
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{partner.name}</div>
          <div className="text-xs text-slate-500 truncate">
            {partner.slug} · {partner.contact_email}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full border ${
              STATUS_STYLE[partner.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {partner.status}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5 border transition-colors ${
              expanded
                ? 'bg-navy text-white border-navy'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Manage
            <svg
              viewBox="0 0 12 12"
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 mb-4">
            {DETAIL_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === key ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'sender' && (
            <SenderEditor
              partnerId={partner.id}
              initialSenderName={partner.email_sender_name}
              initialSenderDomain={partner.email_sender_domain}
            />
          )}
          {tab === 'subdomain' && (
            <SubdomainEditor
              partnerId={partner.id}
              initialSubdomain={partner.subdomain}
              rootDomain={ROOT_DOMAIN}
            />
          )}
          {tab === 'allocation' && (
            <AllocationEditor partnerId={partner.id} partnerName={partner.name} />
          )}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import type { PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { CandidatesPanel } from './_candidates-panel'
import { MintForm } from './_mint-form'

type TabKey = 'candidates' | 'provision'

/**
 * Splits what used to be one long page (roster stacked above the provisioning
 * form) into two sub-tabs. Conditionally rendered — only the active tab's
 * content is ever mounted, not just visually hidden, so the roster table
 * isn't sitting in the DOM while a partner is just provisioning someone, and
 * the form's own local state resets cleanly each time it's switched back to.
 */
export function CandidatesTabs({
  candidates,
  loadError,
  hasActiveProgrammeTerms,
}: {
  candidates: PartnerCandidateWithProgress[]
  loadError: boolean
  hasActiveProgrammeTerms: boolean
}) {
  const [tab, setTab] = useState<TabKey>('candidates')

  function tabClass(key: TabKey) {
    return `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      tab === key ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'
    }`
  }

  return (
    <div>
      <div className="mb-6 inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => setTab('candidates')} className={tabClass('candidates')}>
          Candidates{candidates.length > 0 ? ` (${candidates.length})` : ''}
        </button>
        <button type="button" onClick={() => setTab('provision')} className={tabClass('provision')}>
          Provision
        </button>
      </div>

      {tab === 'candidates' && (
        loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            We couldn’t load your candidates right now. Please refresh — if this keeps happening, contact support.
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-base font-semibold text-slate-900">No candidates yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Switch to the Provision tab to add your first candidate — they’ll receive an invite to start their simulations.
            </p>
            <button
              type="button"
              onClick={() => setTab('provision')}
              className="mt-3 text-sm font-semibold text-teal hover:underline"
            >
              Go to Provision →
            </button>
          </div>
        ) : (
          <CandidatesPanel candidates={candidates} showAdminColumns />
        )
      )}

      {tab === 'provision' && <MintForm hasActiveProgrammeTerms={hasActiveProgrammeTerms} />}
    </div>
  )
}

'use client'
import { useState } from 'react'

export type TermsDoc = {
  id: string
  document_type: 'platform_terms' | 'partner_programme_terms'
  partner_id: string | null
  version: string
  body: string
  document_hash: string
  published_at: string
  is_active: boolean
}

/**
 * Append-only by design (Spec 19 decision 5) — this list only ever displays
 * history, it never offers to edit or delete a row. A superseded version
 * stays fully readable here since it's still what some candidates' acceptance
 * rows point back to.
 */
export function VersionHistory({ docs }: { docs: TermsDoc[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (docs.length === 0) {
    return <p className="text-sm text-slate-400">No versions published yet.</p>
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {docs.map((doc) => (
        <div key={doc.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">v{doc.version}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  doc.is_active
                    ? 'bg-teal/10 text-teal border-teal/30'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {doc.is_active ? 'Active' : 'Superseded'}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(doc.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((prev) => (prev === doc.id ? null : doc.id))}
              className="text-xs font-medium text-teal hover:underline"
            >
              {expanded === doc.id ? 'Hide text' : 'View text'}
            </button>
          </div>
          {expanded === doc.id && (
            <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {doc.body}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

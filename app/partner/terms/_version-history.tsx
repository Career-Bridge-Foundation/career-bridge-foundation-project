'use client'
import { useState } from 'react'

export type PartnerTermsDoc = {
  id: string
  version: string
  body: string | null
  document_hash: string
  published_at: string
  is_active: boolean
  source_storage_path: string | null
  source_file_type: string | null
  signedUrl: string | null // pre-signed, private bucket — expires ~1h after page load
}

/**
 * Append-only, same as the platform-terms history — never offers to edit or
 * delete a row. A text version expands inline; a PDF version opens the
 * signed URL in a new tab (embedding a private-bucket PDF requires no extra
 * auth dance this way, and a new tab avoids fighting the surrounding page's
 * layout for a native PDF viewer).
 */
export function VersionHistory({ docs }: { docs: PartnerTermsDoc[] }) {
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
                {doc.source_file_type ? ` · ${doc.source_file_type.toUpperCase()}` : ' · text'}
              </span>
            </div>
            {doc.source_storage_path ? (
              doc.signedUrl ? (
                <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-teal hover:underline">
                  Open PDF ↗
                </a>
              ) : (
                <span className="text-xs text-slate-400">Link expired</span>
              )
            ) : (
              <button
                type="button"
                onClick={() => setExpanded((prev) => (prev === doc.id ? null : doc.id))}
                className="text-xs font-medium text-teal hover:underline"
              >
                {expanded === doc.id ? 'Hide text' : 'View text'}
              </button>
            )}
          </div>
          {expanded === doc.id && doc.body && (
            <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {doc.body}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

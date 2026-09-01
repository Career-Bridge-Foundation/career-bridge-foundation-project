'use client'

import { useEffect, useState } from 'react'

export type ChecklistDoc = {
  document_type: 'platform_terms' | 'partner_programme_terms'
  partner_id: string | null
  partner_name: string | null
  partner_contact_email: string | null
  version: string
  body: string | null // null when source_file_type is set (PDF)
  source_file_type: string | null
  signed_url: string | null // present only when source_file_type is set
}

const SCROLL_THRESHOLD_PX = 24

function docKey(doc: ChecklistDoc): string {
  return `${doc.document_type}:${doc.partner_id ?? ''}`
}

function docLabel(doc: ChecklistDoc): string {
  return doc.document_type === 'platform_terms'
    ? 'Evidentize Platform Terms of Service'
    : `${doc.partner_name ?? 'Partner'} Programme Terms`
}

function DocumentPanel({
  doc,
  reachedEnd,
  onReachEnd,
}: {
  doc: ChecklistDoc
  reachedEnd: boolean
  onReachEnd: () => void
}) {
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX) {
      onReachEnd()
    }
  }

  const isFile = !!doc.source_file_type

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-bold text-navy">{docLabel(doc)}</h2>
        <p className="text-xs text-slate-400">Version {doc.version}</p>
      </div>
      {isFile ? (
        <div className="px-5 py-4">
          {doc.signed_url ? (
            <a
              href={doc.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onReachEnd}
              className="inline-block text-sm font-semibold text-teal hover:underline"
            >
              Open the document ({doc.source_file_type?.toUpperCase()}) ↗
            </a>
          ) : (
            <p className="text-sm text-red-600">Document link unavailable — please refresh.</p>
          )}
        </div>
      ) : (
        <>
          <div
            onScroll={handleScroll}
            className="max-h-72 overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-slate-700"
          >
            {doc.body}
          </div>
          {!reachedEnd && (
            <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
              Scroll to the end to enable acceptance below.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Shared between the post-auth /accept-terms screen (existing candidates
 * re-prompted after a version change) and the pre-auth redeem preview (a
 * brand-new candidate, before they have an account). Manages its own
 * read/check state and reports the aggregate up via onAllCheckedChange —
 * the caller decides what "continue" actually does (record acceptance vs.
 * route to signup).
 *
 * File-sourced documents (PDF) can't be reliably scroll-gated the way plain
 * text can — the checkbox for those is enabled as soon as the document has
 * been opened once, with different label wording that says so honestly
 * rather than pretending to the same guarantee as the text path.
 */
export function TermsChecklist({
  docs,
  onAllCheckedChange,
}: {
  docs: ChecklistDoc[]
  onAllCheckedChange: (allChecked: boolean) => void
}) {
  const [reachedEnd, setReachedEnd] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [portfolioAck, setPortfolioAck] = useState(false)

  const hasPlatformTerms = docs.some((d) => d.document_type === 'platform_terms')
  const allChecked =
    docs.length > 0 && docs.every((d) => checked[docKey(d)]) && (!hasPlatformTerms || portfolioAck)

  useEffect(() => {
    onAllCheckedChange(allChecked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked])

  return (
    <div className="space-y-6">
      {docs.map((doc) => {
        const key = docKey(doc)
        const isFile = !!doc.source_file_type
        return (
          <div key={key}>
            <DocumentPanel
              doc={doc}
              reachedEnd={!!reachedEnd[key]}
              onReachEnd={() => setReachedEnd((prev) => ({ ...prev, [key]: true }))}
            />
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!checked[key]}
                disabled={!reachedEnd[key]}
                onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="mt-0.5"
              />
              <span>
                {isFile ? 'I have opened and read' : 'I have read and accept'} the {docLabel(doc)}.
              </span>
            </label>

            {doc.document_type === 'platform_terms' && (
              <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={portfolioAck}
                  disabled={!reachedEnd[key]}
                  onChange={(e) => setPortfolioAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I understand that if I choose to publish evidence to my portfolio, it becomes
                  <strong> publicly accessible on the internet</strong>, associated with my name,
                  and hosted indefinitely unless I unpublish it.
                </span>
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}

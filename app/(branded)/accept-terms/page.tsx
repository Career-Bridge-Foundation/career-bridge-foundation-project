'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OutstandingDoc = {
  document_type: 'platform_terms' | 'partner_programme_terms'
  partner_id: string | null
  partner_name: string | null
  version: string
  body: string
}

const SCROLL_THRESHOLD_PX = 24

function DocumentPanel({
  doc,
  reachedEnd,
  onReachEnd,
}: {
  doc: OutstandingDoc
  reachedEnd: boolean
  onReachEnd: () => void
}) {
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX) {
      onReachEnd()
    }
  }

  const label =
    doc.document_type === 'platform_terms'
      ? 'Evidentize Platform Terms of Service'
      : `${doc.partner_name ?? 'Partner'} Programme Terms`

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-bold text-navy">{label}</h2>
        <p className="text-xs text-slate-400">Version {doc.version}</p>
      </div>
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
    </div>
  )
}

export default function AcceptTermsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [docs, setDocs] = useState<OutstandingDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reachedEnd, setReachedEnd] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [portfolioAck, setPortfolioAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [declined, setDeclined] = useState(false)
  const fetchedOnce = useRef(false)

  useEffect(() => {
    if (fetchedOnce.current) return
    fetchedOnce.current = true
    fetch('/api/candidate/acceptance-status')
      .then((r) => r.json())
      .then((data) => {
        const outstanding = (data.outstanding ?? []) as OutstandingDoc[]
        setDocs(outstanding)
        if (outstanding.length === 0) router.replace('/')
      })
      .catch(() => setError('Could not load your acceptance status — please refresh.'))
  }, [router])

  function keyFor(doc: OutstandingDoc): string {
    return `${doc.document_type}:${doc.partner_id ?? ''}`
  }

  const hasPlatformTerms = (docs ?? []).some((d) => d.document_type === 'platform_terms')
  const allChecked =
    (docs ?? []).length > 0 &&
    (docs ?? []).every((d) => checked[keyFor(d)]) &&
    (!hasPlatformTerms || portfolioAck)

  async function handleAccept() {
    if (!docs || !allChecked) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/candidate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptances: docs.map((d) => ({
            document_type: d.document_type,
            partner_id: d.partner_id,
            version: d.version,
          })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Could not record your acceptance — please try again.')
        setSubmitting(false)
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  async function handleDecline() {
    await supabase.auth.signOut()
    setDeclined(true)
  }

  if (declined) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-navy mb-3">You've declined</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            You need to accept both documents to use the platform. Nothing has been created for you.
            If you have questions about the programme, contact the partner who invited you.
          </p>
        </div>
      </main>
    )
  }

  if (!docs) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-navy mb-2">Before you continue</h1>
      <p className="text-sm text-slate-600 mb-6">
        Review and accept both documents below. This only takes a minute, and you'll always be able to find a copy of what you accepted.
      </p>

      <div className="space-y-6">
        {docs.map((doc) => {
          const key = keyFor(doc)
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
                  I have read and accept the{' '}
                  {doc.document_type === 'platform_terms'
                    ? 'Evidentize Platform Terms of Service'
                    : `${doc.partner_name ?? 'Partner'} Programme Terms`}
                  .
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleAccept}
          disabled={!allChecked || submitting}
          className="rounded-md bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Accept and continue'}
        </button>
        <button
          onClick={handleDecline}
          disabled={submitting}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Decline
        </button>
      </div>
    </main>
  )
}

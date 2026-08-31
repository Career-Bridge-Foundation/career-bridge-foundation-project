'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TermsChecklist, type ChecklistDoc } from '@/components/terms/TermsChecklist'

export default function AcceptTermsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [docs, setDocs] = useState<ChecklistDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allChecked, setAllChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [declined, setDeclined] = useState(false)
  const fetchedOnce = useRef(false)

  useEffect(() => {
    if (fetchedOnce.current) return
    fetchedOnce.current = true
    fetch('/api/candidate/acceptance-status')
      .then((r) => r.json())
      .then((data) => {
        const outstanding = (data.outstanding ?? []) as ChecklistDoc[]
        setDocs(outstanding)
        if (outstanding.length === 0) router.replace('/')
      })
      .catch(() => setError('Could not load your acceptance status — please refresh.'))
  }, [router])

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
    // Contact routes for any partner whose programme terms were outstanding
    // — Spec 19: decline "ends the session with a plain explanation and the
    // partner's contact route." Platform terms alone (no partner involved,
    // e.g. an organic signup) has no partner contact to show.
    const partnerContacts = (docs ?? [])
      .filter((d) => d.document_type === 'partner_programme_terms')
      .map((d) => ({ name: d.partner_name, email: d.partner_contact_email }))
      .filter((p) => p.email)

    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-navy mb-3">You've declined</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            You need to accept both documents to use the platform. Nothing has been created for you.
          </p>
          {partnerContacts.length > 0 ? (
            <div className="mt-4 text-sm text-slate-600">
              <p>If you have questions, contact:</p>
              {partnerContacts.map((p, i) => (
                <p key={i} className="mt-1 font-medium text-navy">
                  {p.name ?? 'Your partner'} — <a href={`mailto:${p.email}`} className="underline">{p.email}</a>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">If you have questions about the programme, contact the partner who invited you.</p>
          )}
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

      <TermsChecklist docs={docs} onAllCheckedChange={setAllChecked} />

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

'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import {
  CATEGORY_LABELS,
  DEFAULT_PRIORITY,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  PRIORITY_LABELS,
  SUBJECT_MAX,
  SUBJECT_MIN,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/support/ticket-options'

const NAVY = '#003359'
const DRAFT_KEY = 'cb-support-draft'
const GENERIC_ERROR = 'We couldn’t submit your request right now, please try again in a few minutes.'

type Draft = { subject: string; category: TicketCategory | ''; priority: TicketPriority; description: string }

type Props = {
  email: string
  from: string | null
  initialCategory: TicketCategory | null
}

function readDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null
  } catch {
    return null
  }
}

function writeDraft(d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage unavailable (private mode etc.): drafts are a convenience only.
  }
}

const noopSubscribe = () => () => {}

/**
 * The form reads its unsent draft from sessionStorage in lazy state
 * initialisers, which only works in the browser. So it renders only after
 * hydration (server snapshot = false), which keeps server and client HTML
 * identical without a setState-in-effect restore.
 */
export function SupportPageContent(props: Props) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <div className="h-[520px] rounded-2xl border border-slate-200 bg-white animate-pulse mt-12" />
        </main>
      </div>
    )
  }
  return <SupportForm {...props} />
}

function SupportForm({ email, from, initialCategory }: Props) {
  const router = useRouter()
  // Restore an unsent draft (e.g. after an accidental refresh or back-swipe).
  const [draft] = useState(readDraft)
  const [subject, setSubject] = useState(() => (typeof draft?.subject === 'string' ? draft.subject : ''))
  const [category, setCategory] = useState<TicketCategory | ''>(() => {
    if (initialCategory) return initialCategory
    const c = draft?.category
    return c && (TICKET_CATEGORIES as readonly string[]).includes(c) ? c : ''
  })
  const [priority, setPriority] = useState<TicketPriority>(() => {
    const p = draft?.priority
    return p && (TICKET_PRIORITIES as readonly string[]).includes(p) ? p : DEFAULT_PRIORITY
  })
  const [description, setDescription] = useState(() =>
    typeof draft?.description === 'string' ? draft.description : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const dirty = !ticketNumber && (subject.trim() !== '' || description.trim() !== '')

  useEffect(() => {
    if (ticketNumber) return
    writeDraft(dirty ? { subject, category, priority, description } : null)
  }, [subject, category, priority, description, dirty, ticketNumber])

  // Warn before leaving with an unsent message.
  useEffect(() => {
    if (!dirty || submitting) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, submitting])

  const subjectLen = subject.trim().length
  const descriptionLen = description.trim().length
  const subjectError =
    subjectLen < SUBJECT_MIN ? `Add a short summary (at least ${SUBJECT_MIN} characters).` : null
  const categoryError = !category ? 'Choose what this is about.' : null
  const descriptionError =
    descriptionLen < DESCRIPTION_MIN
      ? `Tell us a bit more (at least ${DESCRIPTION_MIN} characters).`
      : null
  const hasErrors = !!(subjectError || categoryError || descriptionError)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (hasErrors) {
      setShowErrors(true)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/account/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, priority, description, context: from ?? undefined }),
      })
      const data = (await res.json().catch(() => null)) as { ticketNumber?: string; error?: string } | null

      if (res.ok && data?.ticketNumber) {
        writeDraft(null)
        setTicketNumber(data.ticketNumber)
        window.scrollTo({ top: 0 })
        return
      }
      if (res.status === 401) {
        setError('Your session has expired. Please log in again; your message is saved on this page.')
      } else if (res.status === 403) {
        setError('Please accept the latest terms before contacting support.')
      } else {
        setError(data?.error ?? GENERIC_ERROR)
      }
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  function startAnother() {
    setTicketNumber(null)
    setSubject('')
    setDescription('')
    setCategory('')
    setPriority(DEFAULT_PRIORITY)
    setShowErrors(false)
    setError(null)
  }

  const backHref = from ?? '/'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        <button
          type="button"
          onClick={() => (from ? router.push(from) : router.back())}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {ticketNumber ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-6 py-10 text-center">
            <CheckCircle2 size={44} className="mx-auto mb-4 text-teal" aria-hidden />
            <h1
              className="text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: NAVY, fontFamily: "'Fraunces', serif" }}
            >
              Request received
            </h1>
            <p className="text-sm text-slate-600 mb-1">
              Your ticket number is{' '}
              <span className="font-semibold text-slate-900">#{ticketNumber}</span>
            </p>
            <p className="text-sm text-slate-500 mb-8 break-words">
              We’ve sent a confirmation to <span className="font-medium">{email}</span>. Our team will reply
              there, so keep an eye on your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={backHref}
                className="px-5 py-2.5 bg-navy text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
              >
                {from ? 'Back to where I was' : 'Back to home'}
              </Link>
              <button
                type="button"
                onClick={startAnother}
                className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
              >
                Report something else
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1
                className="text-3xl font-bold mb-1"
                style={{ color: NAVY, fontFamily: "'Fraunces', serif" }}
              >
                Help &amp; Support
              </h1>
              <p className="text-sm text-slate-500">
                Something not working, or stuck with your account? Tell us what happened and our team will
                get back to you by email.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white rounded-2xl border border-slate-200 px-5 sm:px-6 py-6 flex flex-col gap-5"
            >
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">Your email</label>
                <p className="text-sm text-slate-500 break-words">
                  {email} <span className="text-xs text-slate-400">(we’ll reply here)</span>
                </p>
              </div>

              <div>
                <label htmlFor="support-category" className="block text-sm font-medium text-slate-800 mb-1.5">
                  What’s this about?
                </label>
                <select
                  id="support-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory | '')}
                  aria-invalid={showErrors && !!categoryError}
                  className="sim-input w-full rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white"
                >
                  <option value="" disabled>
                    Choose one…
                  </option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                {showErrors && categoryError && <p className="text-xs text-red-600 mt-1">{categoryError}</p>}
              </div>

              <div>
                <label htmlFor="support-subject" className="block text-sm font-medium text-slate-800 mb-1.5">
                  Summary
                </label>
                <input
                  id="support-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={SUBJECT_MAX}
                  placeholder="e.g. My simulation won’t submit"
                  aria-invalid={showErrors && !!subjectError}
                  className="sim-input w-full rounded-lg px-3 py-2.5 text-base sm:text-sm"
                />
                {showErrors && subjectError && <p className="text-xs text-red-600 mt-1">{subjectError}</p>}
              </div>

              <div>
                <label htmlFor="support-description" className="block text-sm font-medium text-slate-800 mb-1.5">
                  What happened?
                </label>
                <textarea
                  id="support-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  rows={8}
                  placeholder="What were you trying to do, what did you expect, and what happened instead? Include any error messages you saw."
                  aria-invalid={showErrors && !!descriptionError}
                  className="sim-input w-full rounded-lg px-3 py-2.5 text-base sm:text-sm resize-y min-h-[160px]"
                />
                <div className="flex justify-between gap-3 mt-1">
                  <p className="text-xs text-red-600">{showErrors && descriptionError}</p>
                  <p className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                    {description.length.toLocaleString()} / {DESCRIPTION_MAX.toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="support-priority" className="block text-sm font-medium text-slate-800 mb-1.5">
                  How much is this affecting you?
                </label>
                <select
                  id="support-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="sim-input w-full rounded-lg px-3 py-2.5 text-base sm:text-sm bg-white"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto sm:self-start inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden />}
                {submitting ? 'Sending…' : 'Send to support'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

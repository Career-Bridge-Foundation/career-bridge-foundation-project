'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { disciplines } from '@/lib/disciplines-data'

const DISCIPLINE_OPTIONS = [
  ...disciplines.map((d) => d.name),
  'Other / Not listed',
]

const TIME_OPTIONS = [
  'As soon as possible',
  'Within 1 month',
  '1–3 months',
  '3–6 months',
  'No specific timeline',
]

export function WaitlistButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-apply-inverted text-xs font-medium uppercase px-7 py-3.5 mt-2"
      >
        Join the Waitlist
      </button>
      <WaitlistModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

interface WaitlistModalProps {
  open: boolean
  onClose: () => void
  initialDiscipline?: string
}

const OTHER = 'Other / Not listed'

export function WaitlistModal({ open, onClose, initialDiscipline }: WaitlistModalProps) {
  const [email, setEmail] = useState('')
  const [discipline, setDiscipline] = useState(initialDiscipline ?? '')
  const [customDiscipline, setCustomDiscipline] = useState('')
  const [timeRequested, setTimeRequested] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Sync pre-filled discipline each time the modal opens
  useEffect(() => {
    if (open) {
      setDiscipline(initialDiscipline ?? '')
      setCustomDiscipline('')
    }
  }, [open, initialDiscipline])

  function handleClose() {
    if (loading) return
    onClose()
    // Reset after close animation settles
    setTimeout(() => {
      setEmail('')
      setDiscipline('')
      setCustomDiscipline('')
      setTimeRequested('')
      setError(null)
      setSuccess(false)
    }, 200)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const resolvedDiscipline = discipline === OTHER ? customDiscipline.trim() : discipline
    if (!resolvedDiscipline) {
      setError('Please specify your discipline.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, discipline: resolvedDiscipline, time_requested: timeRequested }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="relative">
        <button
          onClick={handleClose}
          disabled={loading}
          aria-label="Close"
          className="absolute -top-1 -right-1 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
        >
          <X size={18} />
        </button>

        {success ? (
          <SuccessState onClose={handleClose} />
        ) : (
          <FormState
            email={email}
            setEmail={setEmail}
            discipline={discipline}
            setDiscipline={setDiscipline}
            customDiscipline={customDiscipline}
            setCustomDiscipline={setCustomDiscipline}
            timeRequested={timeRequested}
            setTimeRequested={setTimeRequested}
            loading={loading}
            error={error}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Dialog>
  )
}

// ── Success state ──────────────────────────────────────────────────────────────

function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
        <CheckCircle2 className="text-teal" size={28} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-navy mb-2">You&apos;re on the list!</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          We&apos;ll notify you as soon as your discipline launches. Keep an eye on your inbox.
        </p>
      </div>
      <button
        onClick={onClose}
        className="bg-navy text-white text-xs font-medium uppercase tracking-brand-sm px-8 py-3 hover:opacity-90 transition-opacity"
      >
        Done
      </button>
    </div>
  )
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormStateProps {
  email: string
  setEmail: (v: string) => void
  discipline: string
  setDiscipline: (v: string) => void
  customDiscipline: string
  setCustomDiscipline: (v: string) => void
  timeRequested: string
  setTimeRequested: (v: string) => void
  loading: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
}

function FormState({
  email, setEmail,
  discipline, setDiscipline,
  customDiscipline, setCustomDiscipline,
  timeRequested, setTimeRequested,
  loading, error, onSubmit,
}: FormStateProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-navy">Join the Waitlist</h2>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Tell us which discipline you&apos;re interested in and when you&apos;d like access. We&apos;ll notify you when it launches.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-navy uppercase tracking-brand-xs mb-1.5">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            className="sim-input w-full rounded-lg px-4 py-3 text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-navy uppercase tracking-brand-xs mb-1.5">
            Discipline <span className="text-red-500">*</span>
          </label>
          <select
            value={discipline}
            onChange={(e) => { setDiscipline(e.target.value); setCustomDiscipline('') }}
            required
            disabled={loading}
            className="sim-input w-full rounded-lg px-4 py-3 text-sm disabled:opacity-60 bg-white"
          >
            <option value="" disabled>Select a discipline…</option>
            {DISCIPLINE_OPTIONS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {discipline === OTHER && (
            <input
              type="text"
              value={customDiscipline}
              onChange={(e) => setCustomDiscipline(e.target.value)}
              placeholder="e.g. UX Design, Finance, Legal…"
              required
              disabled={loading}
              autoFocus
              className="sim-input w-full rounded-lg px-4 py-3 text-sm disabled:opacity-60 mt-2"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-navy uppercase tracking-brand-xs mb-1.5">
            When would you like access? <span className="text-red-500">*</span>
          </label>
          <select
            value={timeRequested}
            onChange={(e) => setTimeRequested(e.target.value)}
            required
            disabled={loading}
            className="sim-input w-full rounded-lg px-4 py-3 text-sm disabled:opacity-60 bg-white"
          >
            <option value="" disabled>Select a timeframe…</option>
            {TIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-navy text-white w-full py-3 rounded-lg text-xs font-medium uppercase tracking-brand-sm hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
        >
          {loading ? 'Submitting…' : 'Join the Waitlist'}
        </button>
      </form>
    </div>
  )
}

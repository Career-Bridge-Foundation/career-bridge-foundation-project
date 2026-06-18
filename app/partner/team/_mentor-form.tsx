'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MentorForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setDone(null)
    setNotFound(null)
    setInviteSent(null)
    if (!email.trim()) {
      setError('Mentor email is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/partner/mentor-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // Unknown-email 404 is a soft dead-end: offer a mentor invite instead of
        // a raw error. Any other failure keeps the existing error rendering.
        if (res.status === 404) {
          setNotFound(email.trim())
        } else {
          setError(data?.error ? `Could not add mentor: ${data.error}` : 'Could not add mentor.')
        }
        setSubmitting(false)
        return
      }
      setDone(email.trim())
      setEmail('')
      setSubmitting(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  // Mint a role:'mentor' invite for an email that has no account yet
  // (POST /api/partner/invites). Turns the add-mentor dead-end into an invite.
  async function sendInvite() {
    if (!notFound) return
    setError(null)
    setInviting(true)
    try {
      const res = await fetch('/api/partner/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: notFound, role: 'mentor' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ? `Could not send invite: ${data.error}` : 'Could not send invite.')
        setInviting(false)
        return
      }
      setInviteSent(notFound)
      setNotFound(null)
      setEmail('')
      setInviting(false)
    } catch {
      setError('Network error — please try again.')
      setInviting(false)
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Add a mentor</h2>
      <p className="text-sm text-slate-500 mb-4">
        Elevate an existing Career Bridge user to a mentor in your organisation. They must already have an account.
      </p>

      <label className="block text-sm font-medium text-slate-700 mb-1">Mentor email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="mentor@example.com"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-4"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {done && <p className="text-sm text-green-700 mb-4">Added {done} as a mentor.</p>}
      {inviteSent && (
        <p className="text-sm text-green-700 mb-4">Mentor invite sent to {inviteSent}.</p>
      )}

      {notFound && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700 mb-3">
            No Career Bridge account found for {notFound}. Send them a mentor invite instead?
          </p>
          <button
            onClick={sendInvite}
            disabled={inviting}
            className="rounded-md bg-[#006FAD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005d91] disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send mentor invite'}
          </button>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-md bg-[#003359] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00253f] disabled:opacity-50"
      >
        {submitting ? 'Adding…' : 'Add mentor'}
      </button>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setDone(null)
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/partner/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ? `Could not send invite: ${data.error}` : 'Could not send invite.')
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

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Invite a sub-admin</h2>
      <p className="text-sm text-slate-500 mb-4">
        They&rsquo;ll receive an email invitation. On accepting, they become an admin for your
        organisation with the same access you have.
      </p>

      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="colleague@example.com"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-4"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {done && <p className="text-sm text-green-700 mb-4">Invitation sent to {done}.</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-md bg-[#003359] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00253f] disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send invite'}
      </button>
    </div>
  )
}

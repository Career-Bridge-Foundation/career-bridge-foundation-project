'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PartnerInviteForm() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/admin/partner-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orgName, adminEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to create organisation')
      }
      setSuccessMsg(`"${body.partnerName}" created — invite sent to ${body.invitedEmail}.`)
      setOrgName('')
      setAdminEmail('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-1">New partner organisation</h2>
      <p className="text-xs text-slate-500 mb-4">
        Creates the organisation and emails the admin an invite to set up their account.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Organisation name</label>
          <input
            type="text"
            required
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="Acme Foundation"
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Admin email</label>
          <input
            type="email"
            required
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            placeholder="admin@acme.org"
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            disabled={loading || !orgName.trim() || !adminEmail.trim()}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-md hover:bg-teal/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create organisation & send invite'}
          </button>
        </div>
      </form>
    </div>
  )
}

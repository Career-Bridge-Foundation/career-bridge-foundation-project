'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SenderEditor({
  partnerId,
  initialSenderName,
  initialSenderDomain,
}: {
  partnerId: string
  initialSenderName: string | null
  initialSenderDomain: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialSenderName ?? '')
  const [domain, setDomain] = useState(initialSenderDomain ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email_sender_name: name.trim() || null,
          email_sender_domain: domain.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Failed to update sender')
        return
      }
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <h3 className="text-sm font-semibold text-slate-900">Email sender</h3>
      <p className="mt-1 text-xs text-slate-500">
        The name and domain candidate-facing emails for this partner are sent from. Leave blank to use the
        platform default (Evidentize).
      </p>

      {!editing ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <span className="text-sm">
            {initialSenderDomain
              ? <span className="font-mono text-slate-800">{initialSenderName || 'Evidentize'} &lt;noreply@{initialSenderDomain}&gt;</span>
              : <span className="italic text-slate-400">Using platform default</span>}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs font-medium text-teal hover:text-teal/80"
          >
            Customise
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 rounded-md border border-slate-200 bg-white p-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Sender name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="Evidentize"
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Sender domain</label>
            <input
              type="text"
              value={domain}
              onChange={e => { setDomain(e.target.value); setError(null) }}
              placeholder="mail.example.com"
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal/40"
            />
            <p className="mt-1 text-[11px] text-slate-400">Must be verified (SPF/DKIM) in Resend before sends will deliver.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-medium text-white bg-teal hover:bg-teal/90 rounded-md px-3 py-1.5 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setName(initialSenderName ?? '')
                setDomain(initialSenderDomain ?? '')
                setError(null)
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

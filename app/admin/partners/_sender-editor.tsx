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

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-slate-500 hover:text-teal transition-colors"
      >
        {initialSenderDomain
          ? <span className="font-mono">{initialSenderName || 'Evidentize'} &lt;noreply@{initialSenderDomain}&gt;</span>
          : <span className="italic text-slate-400">Default sender — click to customise</span>}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={e => { setName(e.target.value); setError(null) }}
          placeholder="Sender name"
          className="w-32 rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <input
          type="text"
          value={domain}
          onChange={e => { setDomain(e.target.value); setError(null) }}
          placeholder="mail.example.com"
          className="w-36 rounded-md border border-slate-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-medium text-teal hover:text-teal/80 disabled:opacity-50"
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
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-slate-400">Domain must be verified (SPF/DKIM) in Resend before sends will deliver.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

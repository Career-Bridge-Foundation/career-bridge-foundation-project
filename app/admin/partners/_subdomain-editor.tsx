'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SubdomainEditor({
  partnerId,
  initialSubdomain,
  rootDomain,
}: {
  partnerId: string
  initialSubdomain: string | null
  rootDomain: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialSubdomain ?? '')
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
        body: JSON.stringify({ subdomain: value.trim() || null }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Failed to update subdomain')
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
        {initialSubdomain
          ? <span className="font-mono">{initialSubdomain}.{rootDomain}</span>
          : <span className="italic text-slate-400">No subdomain — click to assign</span>}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(null) }}
          placeholder="acme"
          className="w-28 rounded-md border border-slate-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <span className="text-xs text-slate-400 font-mono">.{rootDomain}</span>
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
          onClick={() => { setEditing(false); setValue(initialSubdomain ?? ''); setError(null) }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

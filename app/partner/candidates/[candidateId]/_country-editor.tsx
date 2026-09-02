'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRIES, countryName } from '@/lib/countries'

export function CountryEditor({
  candidateId,
  initialCountry,
}: {
  candidateId: string
  initialCountry: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialCountry ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ country: value }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Failed to update country')
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
        className="text-sm text-slate-500 hover:text-teal transition-colors"
      >
        {initialCountry
          ? countryName(initialCountry)
          : <span className="italic text-slate-400">No country set — click to add</span>}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        autoFocus
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null) }}
        className="rounded-md border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
      >
        <option value="">Select…</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !value}
        className="text-sm font-medium text-teal hover:text-teal/80 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => { setEditing(false); setValue(initialCountry ?? ''); setError(null) }}
        className="text-sm text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

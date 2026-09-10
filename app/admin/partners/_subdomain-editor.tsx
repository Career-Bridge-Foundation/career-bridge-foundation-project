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

  return (
    <div className="max-w-md">
      <h3 className="text-sm font-semibold text-slate-900">Subdomain</h3>
      <p className="mt-1 text-xs text-slate-500">
        Where this partner&apos;s candidates and staff access their branded portal.
      </p>

      {!editing ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <span className="text-sm">
            {initialSubdomain
              ? <span className="font-mono text-slate-800">{initialSubdomain}.{rootDomain}</span>
              : <span className="italic text-slate-400">No subdomain assigned</span>}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs font-medium text-teal hover:text-teal/80"
          >
            {initialSubdomain ? 'Change' : 'Assign'}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 rounded-md border border-slate-200 bg-white p-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Subdomain</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={value}
                onChange={e => { setValue(e.target.value); setError(null) }}
                placeholder="acme"
                className="w-32 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal/40"
              />
              <span className="text-sm text-slate-400 font-mono">.{rootDomain}</span>
            </div>
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
              onClick={() => { setEditing(false); setValue(initialSubdomain ?? ''); setError(null) }}
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

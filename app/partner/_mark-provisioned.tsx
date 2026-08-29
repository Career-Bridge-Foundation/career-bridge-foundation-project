'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Manual provisioning override (Spec 19 decision 10: "the console always
 * offers manual provisioning and manual marking... it is how the proof
 * cohort runs if the integration is not ready"). No Circle API call exists
 * yet — this just records that a partner admin did it themselves in Circle
 * directly and is telling the platform so.
 */
export function MarkProvisioned({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner/candidates/${candidateId}/mark-provisioned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ community_member_id: memberId.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Failed to update')
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
        className="text-xs font-medium text-teal hover:underline"
      >
        Mark as provisioned
      </button>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={memberId}
          onChange={(e) => { setMemberId(e.target.value); setError(null) }}
          placeholder="Circle member id (optional)"
          className="w-40 rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-medium text-teal hover:text-teal/80 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setMemberId(''); setError(null) }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

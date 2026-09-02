'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PublishForm({
  documentType,
  partnerId,
  currentVersion,
  onPublished,
}: {
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  currentVersion: string | null
  onPublished?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePublish() {
    if (!version.trim() || !body.trim()) {
      setError('Version and document text are both required.')
      return
    }
    const activeNote = currentVersion
      ? `This deactivates the current active version (${currentVersion}) for future acceptances — candidates who already accepted it keep that acceptance on record, but anyone not yet accepted will see this new version instead. Continue?`
      : 'This activates the first version of this document, which starts gating candidates. Continue?'
    if (!window.confirm(activeNote)) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/terms-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          document_type: documentType,
          partner_id: partnerId,
          version: version.trim(),
          body,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not publish.')
        setSubmitting(false)
        return
      }
      setVersion('')
      setBody('')
      setOpen(false)
      setSubmitting(false)
      onPublished?.()
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Publish new version
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Version
        </label>
        <input
          type="text"
          value={version}
          onChange={(e) => { setVersion(e.target.value); setError(null) }}
          placeholder="e.g. 1.0"
          className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Document text
        </label>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setError(null) }}
          rows={16}
          placeholder="Paste the full, final document text here — this is exactly what candidates will see and what the acceptance record is hashed against."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={submitting}
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Publish and activate'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={submitting}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

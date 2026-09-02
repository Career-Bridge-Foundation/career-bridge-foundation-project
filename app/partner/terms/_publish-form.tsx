'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SourceMode = 'text' | 'pdf'

export function PublishForm({ currentVersion }: { currentVersion: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<SourceMode>('text')
  const [version, setVersion] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePublish() {
    if (!version.trim()) {
      setError('Version is required.')
      return
    }
    if (mode === 'text' && !body.trim()) {
      setError('Document text is required.')
      return
    }
    if (mode === 'pdf' && !file) {
      setError('Choose a PDF to upload.')
      return
    }
    const activeNote = currentVersion
      ? `This deactivates your current active version (${currentVersion}) for future acceptances — candidates who already accepted it keep that acceptance on record, but anyone not yet accepted will see this new version instead. Continue?`
      : 'This publishes your first version, which starts asking candidates to accept it going forward. Continue?'
    if (!window.confirm(activeNote)) return

    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('version', version.trim())
      if (mode === 'text') {
        form.set('body', body)
      } else if (file) {
        form.set('file', file)
      }
      const res = await fetch('/api/partner/terms-documents', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not publish.')
        setSubmitting(false)
        return
      }
      setVersion('')
      setBody('')
      setFile(null)
      setOpen(false)
      setSubmitting(false)
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

      <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`rounded px-3 py-1 text-xs font-medium ${mode === 'text' ? 'bg-navy text-white' : 'text-slate-600'}`}
        >
          Type it in
        </button>
        <button
          type="button"
          onClick={() => setMode('pdf')}
          className={`rounded px-3 py-1 text-xs font-medium ${mode === 'pdf' ? 'bg-navy text-white' : 'text-slate-600'}`}
        >
          Upload PDF
        </button>
      </div>

      {mode === 'text' ? (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Document text
          </label>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setError(null) }}
            rows={16}
            placeholder="Paste your full, final programme terms here — this is exactly what candidates will see and what the acceptance record is hashed against."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed"
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            PDF file
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null) }}
            className="block w-full text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            PDF only, up to 10MB. Candidates won&apos;t be required to scroll to the end of an uploaded document
            the way they are for typed text — they'll instead confirm they've read it before continuing.
          </p>
        </div>
      )}

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

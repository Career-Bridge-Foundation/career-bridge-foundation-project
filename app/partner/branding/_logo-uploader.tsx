'use client'
import { useRef, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/webp'
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024

export function LogoUploader({
  slot,
  label,
  description,
  initialUrl,
  dark,
}: {
  slot: 'icon' | 'on_light' | 'on_dark'
  label: string
  description: string
  initialUrl: string | null
  dark?: boolean // preview on a dark swatch (for on_dark)
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    // Client-side pre-check (UX only — server re-validates by content).
    if (!ALLOWED.has(file.type)) { setError('Use a PNG, JPEG, or WebP image.'); return }
    if (file.size > MAX_BYTES) { setError('File exceeds the 2 MB limit.'); return }

    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('slot', slot)
      fd.append('file', file)
      const res = await fetch('/api/partner/branding/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) setError(data?.error ?? 'Upload failed.')
      else setUrl(data.url)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/partner/branding/logo?slot=${slot}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) setError(data?.error ?? 'Could not remove.')
      else setUrl(null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <p className="mb-3 text-xs text-slate-400">{description}</p>

      <div
        className={`mb-3 flex h-20 items-center justify-center overflow-hidden rounded-md border ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-16 max-w-[80%] object-contain" />
        ) : (
          <span className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-400'}`}>Default (Evidentize)</span>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? 'Working…' : url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button type="button" onClick={onRemove} disabled={busy} className="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-50">
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

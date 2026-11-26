'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { disciplines } from '@/lib/disciplines-data'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))

type State = {
  range: string[]
  mine: string[]
  otherPartners: string[]
  inProgress: string[]
}

/**
 * Spec 20 — edit the disciplines this partner grants an already-redeemed
 * candidate. No email, no credit. `apiBase` is /api/partner or /api/mentor
 * (middleware confines each role to its own API prefix).
 */
export function CandidateDisciplinesEditor({
  candidateId,
  candidateName,
  apiBase,
  onClose,
}: {
  candidateId: string
  candidateName: string
  apiBase: '/api/partner' | '/api/mentor'
  onClose: () => void
}) {
  const router = useRouter()
  const url = `${apiBase}/candidates/${candidateId}/disciplines`
  const [state, setState] = useState<State | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setLoadError(body.error ?? 'Could not load disciplines')
          return
        }
        setState(body)
        setSelected(body.mine)
      })
      .catch(() => !cancelled && setLoadError('Network error'))
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Range first, then anything this partner still grants outside it (removable,
  // not re-addable), then other partners' grants (read-only).
  const options = state
    ? [...new Set([...state.range, ...state.mine, ...state.otherPartners])].sort((a, b) =>
        (DISCIPLINE_NAME.get(a) ?? a).localeCompare(DISCIPLINE_NAME.get(b) ?? b))
    : []

  const removingInProgress = state
    ? state.mine.filter((d) => !selected.includes(d) && state.inProgress.includes(d))
    : []
  const dirty = !!state &&
    (state.mine.length !== selected.length || state.mine.some((d) => !selected.includes(d)))

  function toggle(slug: string) {
    setError(null)
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disciplines: selected }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Could not save disciplines')
        return
      }
      if (body.failed?.length) {
        const names = body.failed.map((f: { discipline: string }) => DISCIPLINE_NAME.get(f.discipline) ?? f.discipline)
        setError(`Some changes didn't save (${names.join(', ')}). Try again.`)
        setState((s) => (s ? { ...s, mine: body.mine } : s))
        setSelected(body.mine)
        router.refresh()
        return
      }
      router.refresh()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-disciplines-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="edit-disciplines-title" className="text-base font-semibold text-navy">Edit disciplines</h2>
        <p className="mt-0.5 text-sm text-slate-500">{candidateName}</p>

        {loadError ? (
          <p className="mt-4 text-sm text-red-600">{loadError}</p>
        ) : !state ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {options.map((slug) => {
                const elsewhere = state.otherPartners.includes(slug)
                const outOfRange = !state.range.includes(slug)
                const checked = elsewhere || selected.includes(slug)
                // Out-of-range grants can be removed but not put back.
                const disabled = elsewhere || (outOfRange && !selected.includes(slug))
                return (
                  <label
                    key={slug}
                    className={`flex items-start gap-2 text-sm ${disabled ? 'text-slate-400' : 'text-slate-700'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(slug)}
                    />
                    <span>
                      {DISCIPLINE_NAME.get(slug) ?? slug}
                      {elsewhere && <span className="block text-[11px]">Granted by another organisation</span>}
                      {!elsewhere && outOfRange && (
                        <span className="block text-[11px]">No longer offered by your organisation</span>
                      )}
                      {!elsewhere && state.inProgress.includes(slug) && (
                        <span className="block text-[11px] text-amber-700">Simulation in progress</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>

            {removingInProgress.length > 0 && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                They can finish their current{' '}
                {removingInProgress.map((d) => DISCIPLINE_NAME.get(d) ?? d).join(', ')} simulation and keep the
                result, but won&apos;t be able to retry.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-400">Changes apply straight away. No email is sent.</p>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || selected.length === 0}
            title={selected.length === 0 ? 'Keep at least one discipline' : undefined}
            className="rounded-md bg-teal px-4 py-1.5 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

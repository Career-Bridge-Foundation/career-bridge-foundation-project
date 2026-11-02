'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { grantableDisciplines } from '@/lib/disciplines-data'

type Impact = Record<string, { candidates: number; inProgress: number }>

const ALL_SLUGS = grantableDisciplines.map((d) => d.slug)
const NAME = new Map(grantableDisciplines.map((d) => [d.slug, d.name] as const))

/** Empty range = unrestricted, so the effective set is every grantable discipline. */
function effective(slugs: string[]) {
  return slugs.length ? slugs : ALL_SLUGS
}

/**
 * Spec 20 — the disciplines a partner may grant. Nothing ticked means
 * unrestricted. Narrowing revokes this partner's candidates in the removed
 * disciplines (server-side); the confirm spells out who that affects.
 */
export function DisciplineEditor({
  partnerId,
  initialDisciplines,
}: {
  partnerId: string
  initialDisciplines: string[]
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<string[]>(initialDisciplines)
  const [selected, setSelected] = useState<string[]>(initialDisciplines)
  const [impact, setImpact] = useState<Impact>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/partners/${partnerId}/disciplines`, { credentials: 'include' })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.impact) setImpact(body.impact)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [partnerId])

  const dirty = saved.length !== selected.length || saved.some((s) => !selected.includes(s))

  function toggle(slug: string) {
    setNotice(null)
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  async function handleSave() {
    const next = effective(selected)
    const removed = effective(saved).filter((s) => !next.includes(s) && impact[s]?.candidates)
    if (removed.length) {
      const lines = removed.map((s) => {
        const i = impact[s]
        return `• ${NAME.get(s) ?? s}: ${i.candidates} candidate${i.candidates === 1 ? '' : 's'}` +
          (i.inProgress ? ` (${i.inProgress} mid-simulation)` : '')
      })
      const ok = window.confirm(
        `This removes access for this partner's candidates in:\n\n${lines.join('\n')}\n\n` +
        `Candidates who haven't started lose access now. Candidates mid-simulation can finish it ` +
        `(and keep their certificate and portfolio evidence) but can't retry. Continue?`
      )
      if (!ok) return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/disciplines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ disciplines: selected }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? 'Failed to update disciplines')
        return
      }
      setSaved(selected)
      if (body.revokedEntitlements) {
        setNotice(`Saved — ${body.revokedEntitlements} candidate discipline grant${body.revokedEntitlements === 1 ? '' : 's'} revoked.`)
        // Refresh counts now that some grants are gone.
        const fresh = await fetch(`/api/admin/partners/${partnerId}/disciplines`, { credentials: 'include' })
          .then((r) => r.json()).catch(() => null)
        if (fresh?.impact) setImpact(fresh.impact)
      } else {
        setNotice('Saved.')
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <h3 className="text-sm font-semibold text-slate-900">Disciplines</h3>
      <p className="mt-1 text-xs text-slate-500">
        The disciplines this partner can invite candidates into. Leave everything unticked to allow all disciplines.
      </p>

      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">
          {selected.length === 0
            ? 'Unrestricted — all disciplines'
            : `${selected.length} of ${ALL_SLUGS.length} disciplines`}
        </p>
        <div className="space-y-1.5">
          {grantableDisciplines.map((d) => {
            const count = impact[d.slug]?.candidates ?? 0
            return (
              <label key={d.slug} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.includes(d.slug)} onChange={() => toggle(d.slug)} />
                  {d.name}
                  {d.status !== 'available' && <span className="text-[11px] text-slate-400">(coming soon)</span>}
                </span>
                {count > 0 && (
                  <span className="text-[11px] text-slate-400">{count} candidate{count === 1 ? '' : 's'}</span>
                )}
              </label>
            )
          })}
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {notice && <p className="mt-3 text-xs text-emerald-700">{notice}</p>}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="text-xs font-medium text-white bg-teal hover:bg-teal/90 rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => { setSelected(saved); setError(null) }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

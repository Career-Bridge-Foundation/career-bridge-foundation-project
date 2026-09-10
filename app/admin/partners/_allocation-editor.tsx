'use client'
import { useState } from 'react'

type Allocation = {
  id: string
  committed_credits: number
  buffer_pct: number
  period_start: string
  period_end: string
  created_at: string
}

function isActive(a: Allocation) {
  const now = Date.now()
  return new Date(a.period_start).getTime() <= now && now <= new Date(a.period_end).getTime()
}

function ceiling(a: Allocation) {
  return Math.round(a.committed_credits * (1 + a.buffer_pct / 100))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// <input type="date"> works in local date strings (yyyy-mm-dd); stored
// period_start/period_end are timestamptz. Midnight local time is close
// enough for a contract-period boundary — this isn't billing-second precision.
function toDateInputValue(iso: string) {
  return iso ? iso.slice(0, 10) : ''
}

export function AllocationEditor({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allocations, setAllocations] = useState<Allocation[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [credits, setCredits] = useState('')
  const [bufferPct, setBufferPct] = useState('10')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/allocation`, { credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(body.error ?? 'Failed to load ceiling')
        return
      }
      setAllocations(body.allocations ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function openModal() {
    setModalOpen(true)
    setFormOpen(false)
    if (allocations === null) await load()
  }

  function closeModal() {
    setModalOpen(false)
    setFormOpen(false)
  }

  function startCreate() {
    setEditingId(null)
    setCredits('')
    setBufferPct('10')
    setPeriodStart('')
    setPeriodEnd('')
    setSaveError(null)
    setFormOpen(true)
  }

  function startEdit(a: Allocation) {
    setEditingId(a.id)
    setCredits(String(a.committed_credits))
    setBufferPct(String(a.buffer_pct))
    setPeriodStart(toDateInputValue(a.period_start))
    setPeriodEnd(toDateInputValue(a.period_end))
    setSaveError(null)
    setFormOpen(true)
  }

  async function handleSave() {
    const committed_credits = Number(credits)
    const buffer_pct = Number(bufferPct)
    if (!Number.isInteger(committed_credits) || committed_credits <= 0) {
      setSaveError('Committed credits must be a positive whole number')
      return
    }
    if (!Number.isInteger(buffer_pct) || buffer_pct < 0) {
      setSaveError('Buffer % must be zero or a positive whole number')
      return
    }
    if (!periodStart || !periodEnd) {
      setSaveError('Both period dates are required')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/allocation`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          committed_credits,
          buffer_pct,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(body.error ?? 'Failed to save ceiling')
        return
      }
      setFormOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const active = allocations?.find(isActive) ?? null

  return (
    <div className="max-w-md">
      <h3 className="text-sm font-semibold text-slate-900">Credit allocation</h3>
      <p className="mt-1 text-xs text-slate-500">
        The credit ceiling this partner&apos;s sponsor-code minting is checked against.
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-sm">
          {active
            ? <span className="font-mono text-slate-800">{active.committed_credits.toLocaleString()} credits + {active.buffer_pct}% buffer</span>
            : <span className="italic text-slate-400">No active ceiling</span>}
        </span>
        <button
          type="button"
          onClick={openModal}
          className="shrink-0 text-xs font-medium text-teal hover:text-teal/80"
        >
          Manage
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Credit allocation</h2>
                <p className="text-xs text-slate-500 mt-0.5">{partnerName}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-md p-3">
                Each allocation period sets how many sponsor-code credits this partner can mint, and over what
                dates. <span className="font-medium text-slate-700">Committed credits</span> is the number they&apos;ve
                contracted for. <span className="font-medium text-slate-700">Buffer %</span> adds headroom on top
                (e.g. 10% covers edge cases) before minting is blocked — the effective ceiling is committed
                credits × (1 + buffer). Periods can&apos;t overlap, and only the period covering today counts as
                active.
              </p>

              {loading && <p className="text-xs text-slate-400">Loading…</p>}
              {loadError && <p className="text-xs text-red-600">{loadError}</p>}

              {!loading && !loadError && allocations && (
                <>
                  {allocations.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No allocation periods yet.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="text-left font-medium px-3 py-2">Committed</th>
                            <th className="text-left font-medium px-3 py-2">Buffer</th>
                            <th className="text-left font-medium px-3 py-2">Ceiling</th>
                            <th className="text-left font-medium px-3 py-2">Period</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allocations.map(a => (
                            <tr key={a.id} className={isActive(a) ? 'bg-teal/5' : undefined}>
                              <td className="px-3 py-2 font-mono text-slate-800">{a.committed_credits.toLocaleString()}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{a.buffer_pct}%</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{ceiling(a).toLocaleString()}</td>
                              <td className="px-3 py-2 text-slate-500">
                                {fmtDate(a.period_start)} – {fmtDate(a.period_end)}
                                {isActive(a) && <span className="ml-1.5 text-teal font-medium">· active</span>}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => startEdit(a)} className="text-slate-400 hover:text-teal font-medium">
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!formOpen && (
                    <button
                      type="button"
                      onClick={startCreate}
                      className="text-xs font-medium text-teal hover:text-teal/80"
                    >
                      + Add allocation period
                    </button>
                  )}
                </>
              )}

              {formOpen && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold text-slate-700">
                    {editingId ? 'Edit allocation period' : 'New allocation period'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Committed credits</label>
                      <input
                        type="number"
                        min={1}
                        autoFocus
                        value={credits}
                        onChange={e => { setCredits(e.target.value); setSaveError(null) }}
                        placeholder="e.g. 500"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Credits contracted for this period.</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Buffer %</label>
                      <input
                        type="number"
                        min={0}
                        value={bufferPct}
                        onChange={e => { setBufferPct(e.target.value); setSaveError(null) }}
                        placeholder="10"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Headroom before minting blocks.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Period start</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={e => { setPeriodStart(e.target.value); setSaveError(null) }}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Period end</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={e => { setPeriodEnd(e.target.value); setSaveError(null) }}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">Must not overlap an existing period for this partner.</p>
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="text-xs font-medium text-white bg-teal hover:bg-teal/90 rounded-md px-3 py-1.5 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

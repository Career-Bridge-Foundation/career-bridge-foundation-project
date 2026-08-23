'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { AllocationState } from '@/lib/entitlement/ceiling'
import type { EffectiveCodeStatus } from '@/lib/entitlement/codeStatus'

export type CodeRow = {
  id: string
  code: string
  display_code: string
  label: string | null
  batch_id: string | null
  credits_per_redemption: number
  max_redemptions: number
  redemptions_used: number
  cohort_id: string | null
  expires_at: string
  created_at: string
  revoked_at: string | null
  note: string | null
  reserved_value: number
  reserved_remaining: number
  status: EffectiveCodeStatus
}

type RedemptionEvent = {
  candidate_id: string
  candidate_name: string | null
  credits_granted: number
  redeemed_at: string
}

type MintResult = {
  batch_id: string | null
  codes: { id: string; code: string }[]
  reserved: number
}

type PreviewState = {
  reserved: number
  remaining_before: number
  remaining_after: number
  would_exceed: boolean
  shortfall: number
} | null

const STATUS_STYLES: Record<EffectiveCodeStatus, string> = {
  active:    'bg-teal/10 text-teal',
  expired:   'bg-slate-100 text-slate-500',
  exhausted: 'bg-amber-50 text-amber-700',
  revoked:   'bg-red-50 text-red-600',
}

const STATUS_FILTERS: (EffectiveCodeStatus | 'all')[] = ['active', 'exhausted', 'expired', 'revoked', 'all']

export function CodesView({
  allocation: initialAllocation,
  initialCodes,
}: {
  allocation: AllocationState
  initialCodes: CodeRow[]
}) {
  const [codes, setCodes] = useState<CodeRow[]>(initialCodes)
  const [alloc, setAlloc] = useState<AllocationState>(initialAllocation)
  const [statusFilter, setStatusFilter] = useState<EffectiveCodeStatus | 'all'>('active')

  const [shape, setShape] = useState<'unique' | 'shared'>('unique')
  const [label, setLabel] = useState('')
  const [prefix, setPrefix] = useState('')
  const [cpr, setCpr] = useState('')
  const [quantity, setQuantity] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')

  const [preview, setPreview] = useState<PreviewState>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [minting, setMinting] = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintResult, setMintResult] = useState<MintResult | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [redemptionsByCode, setRedemptionsByCode] = useState<Record<string, RedemptionEvent[]>>({})

  const cprNum = parseInt(cpr) || 0
  const quantityNum = parseInt(quantity) || 0
  const today = new Date().toISOString().split('T')[0]

  // Live preview — re-fetch whenever the numbers that matter change. Below
  // 1/1 we simply don't fetch; the render guard (cprNum > 0 && quantityNum >
  // 0) already hides stale preview output in that case, so there's no need
  // to clear state synchronously from the effect body.
  useEffect(() => {
    if (cprNum < 1 || quantityNum < 1) return
    let cancelled = false
    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/partner/codes/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credits_per_redemption: cprNum, quantity: quantityNum }),
        })
        if (cancelled) return
        if (res.ok) {
          setPreview(await res.json())
        } else {
          setPreview(null)
        }
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cprNum, quantityNum])

  async function refreshAllocation() {
    try {
      const res = await fetch('/api/partner/allocation')
      if (res.ok) setAlloc(await res.json())
    } catch { /* ignore — stale display is acceptable */ }
  }

  async function refreshCodes() {
    try {
      const res = await fetch('/api/partner/codes?limit=200')
      if (res.ok) {
        const data = await res.json()
        setCodes(data.codes ?? [])
      }
    } catch { /* keep stale list on failure */ }
  }

  function resetMintForm() {
    setLabel('')
    setPrefix('')
    setCpr('')
    setQuantity('')
    setCohortId('')
    setExpiresAt('')
    setNote('')
    setPreview(null)
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    if (minting) return
    setMinting(true)
    setMintError(null)
    setMintResult(null)
    try {
      const res = await fetch('/api/partner/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape,
          label: label.trim(),
          prefix: prefix.trim().toUpperCase(),
          credits_per_redemption: cprNum,
          quantity: quantityNum,
          cohort_id: cohortId.trim() || undefined,
          expires_at: new Date(expiresAt).toISOString(),
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMintError(data.error ?? 'Something went wrong.')
        return
      }
      setMintResult(data as MintResult)
      resetMintForm()
      await Promise.all([refreshAllocation(), refreshCodes()])
    } catch {
      setMintError('Network error — please try again.')
    } finally {
      setMinting(false)
    }
  }

  async function handleCopyAll() {
    if (!mintResult) return
    try {
      await navigator.clipboard.writeText(mintResult.codes.map((c) => c.code).join('\n'))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch { /* clipboard denied — user can select manually from the list below */ }
  }

  async function handleRevoke(codeId: string) {
    if (revoking) return
    setRevoking(codeId)
    try {
      const res = await fetch(`/api/partner/codes/${codeId}/revoke`, { method: 'POST' })
      if (res.ok) {
        await Promise.all([refreshAllocation(), refreshCodes()])
      }
    } finally {
      setRevoking(null)
    }
  }

  async function handleBatchRevoke(batchId: string) {
    if (revoking) return
    setRevoking(batchId)
    try {
      const res = await fetch(`/api/partner/codes/batch/${batchId}/revoke`, { method: 'POST' })
      if (res.ok) {
        await Promise.all([refreshAllocation(), refreshCodes()])
      }
    } finally {
      setRevoking(null)
    }
  }

  async function toggleExpand(codeId: string) {
    if (expandedCode === codeId) {
      setExpandedCode(null)
      return
    }
    setExpandedCode(codeId)
    if (!redemptionsByCode[codeId]) {
      try {
        const res = await fetch(`/api/partner/codes/${codeId}/redemptions`)
        if (res.ok) {
          const data = await res.json()
          setRedemptionsByCode((prev) => ({ ...prev, [codeId]: data.redemptions ?? [] }))
        }
      } catch { /* leave unexpanded content empty on failure */ }
    }
  }

  const filteredCodes = useMemo(
    () => (statusFilter === 'all' ? codes : codes.filter((c) => c.status === statusFilter)),
    [codes, statusFilter],
  )

  // Group by batch_id — standalone/shared codes (batch_id null) are their own group.
  const groups = useMemo(() => {
    const byBatch = new Map<string, CodeRow[]>()
    const standalone: CodeRow[] = []
    for (const c of filteredCodes) {
      if (c.batch_id) {
        const arr = byBatch.get(c.batch_id) ?? []
        arr.push(c)
        byBatch.set(c.batch_id, arr)
      } else {
        standalone.push(c)
      }
    }
    return { byBatch, standalone }
  }, [filteredCodes])

  // Allocation banner styling
  const bannerBorder =
    alloc.bufferState === 'hard_stop'   ? 'border-red-200 bg-red-50' :
    alloc.bufferState === 'at_ceiling'  ? 'border-orange-200 bg-orange-50' :
    alloc.bufferState === 'warning'     ? 'border-amber-200 bg-amber-50' :
    'border-slate-200 bg-white'

  const barColor =
    alloc.bufferState === 'hard_stop'  ? 'bg-red-500' :
    alloc.bufferState === 'at_ceiling' ? 'bg-orange-400' :
    alloc.bufferState === 'warning'    ? 'bg-amber-400' :
    'bg-teal'

  const consumedPct = alloc.committed > 0
    ? Math.min(100, Math.round((alloc.consumed / alloc.committed) * 100))
    : 0

  const mintDisabled =
    minting ||
    previewLoading ||
    !preview ||
    preview.would_exceed ||
    !label.trim() ||
    !prefix.trim() ||
    !cpr ||
    !quantity ||
    !expiresAt

  return (
    <div className="space-y-8">

      {/* Allocation banner — always visible, never collapsed */}
      <div className={`rounded-lg border p-5 ${bannerBorder}`}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Credit ceiling</p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-2xl font-bold text-navy">{alloc.consumed}</span>
          <span className="text-sm text-slate-600">of {alloc.committed} committed credits consumed</span>
          <span className="text-sm text-slate-400">
            reserved {alloc.reserved} · {alloc.remaining} remaining (hard ceiling: {alloc.hardCeiling})
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${consumedPct}%` }} />
        </div>
        {alloc.bufferState === 'hard_stop' && (
          <p className="mt-2 text-xs font-medium text-red-700">
            Hard stop reached — new activations are blocked until your ceiling is raised. Contact Evidentize.
          </p>
        )}
        {alloc.bufferState === 'at_ceiling' && (
          <p className="mt-2 text-xs font-medium text-orange-700">
            At ceiling — you are drawing on the {alloc.bufferPct}% overdraft buffer. Contact Evidentize to extend your commitment.
          </p>
        )}
        {alloc.bufferState === 'warning' && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Approaching ceiling — {alloc.consumed} of {alloc.committed} credits consumed.
          </p>
        )}
      </div>

      {/* Mint panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-navy">Mint codes</h2>
        <form onSubmit={handleMint} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Autumn 2026 CTI cohort"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Shape</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShape('unique')}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  shape === 'unique' ? 'border-navy bg-navy text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                Unique codes
              </button>
              <button
                type="button"
                onClick={() => setShape('shared')}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  shape === 'shared' ? 'border-navy bg-navy text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                Shared code
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {shape === 'unique'
                ? 'One code per candidate, individually revocable — the default. Suits one-to-one email distribution.'
                : 'One code string, many redemptions. Convenient — and it leaks the moment one candidate forwards it.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="CBF25"
                maxLength={8}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">Up to 8 characters, for your own legibility. Codes read {prefix || 'PREFIX'}-XXXXXXXX.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Expires on</label>
              <input
                type="date"
                min={today}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Credits per candidate</label>
              <input
                type="number"
                min={1}
                value={cpr}
                onChange={(e) => setCpr(e.target.value)}
                placeholder="3"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Number of candidates</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="20"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Cohort ID <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                placeholder="Scopes redeemed credits to a cohort's scenario set"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Note <span className="font-normal text-slate-400">(optional, partner-internal)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
          </div>

          {/* Live preview — the safeguard against misreading the two quantity fields */}
          {cprNum > 0 && quantityNum > 0 && (
            <div className={`rounded-md border p-3 text-sm ${preview?.would_exceed ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              {previewLoading || !preview ? (
                <span className="text-slate-400">Checking against your ceiling…</span>
              ) : preview.would_exceed ? (
                <>
                  {quantityNum} candidate{quantityNum === 1 ? '' : 's'} × {cprNum} credit{cprNum === 1 ? '' : 's'} = <strong>{preview.reserved} credits reserved</strong> — exceeds remaining ceiling by {preview.shortfall}.
                </>
              ) : (
                <>
                  {quantityNum} candidate{quantityNum === 1 ? '' : 's'} × {cprNum} credit{cprNum === 1 ? '' : 's'} = <strong>{preview.reserved} credits reserved</strong>. Remaining after mint: {preview.remaining_after} of {alloc.hardCeiling}.
                </>
              )}
            </div>
          )}

          {mintError && <p className="text-xs text-red-600">{mintError}</p>}

          <button
            type="submit"
            disabled={mintDisabled}
            className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {minting ? 'Minting…' : shape === 'unique' ? `Mint ${quantityNum || ''} codes` : 'Mint code'}
          </button>
        </form>
      </div>

      {/* Result state */}
      {mintResult && (
        <div className="rounded-lg border border-teal/40 bg-teal/5 p-6">
          {mintResult.batch_id ? (
            <>
              <h3 className="mb-1 text-sm font-semibold text-navy">
                {mintResult.codes.length} codes minted
              </h3>
              <p className="mb-3 text-xs text-amber-700">
                This is the only convenient moment to export — codes remain retrievable from the list below, but it&apos;s easy to assume otherwise.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="rounded-md border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
                >
                  {copiedAll ? 'Copied!' : 'Copy all codes'}
                </button>
                <a
                  href={`/api/partner/codes/export?batch_id=${mintResult.batch_id}`}
                  className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
                >
                  Download CSV
                </a>
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-navy">Code minted</h3>
              <p className="font-mono text-2xl tracking-widest text-navy">{mintResult.codes[0]?.code}</p>
              <button
                type="button"
                onClick={handleCopyAll}
                className="mt-3 rounded-md border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
              >
                {copiedAll ? 'Copied!' : 'Copy code'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Code list */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-navy">
            Your codes{filteredCodes.length > 0 ? ` (${filteredCodes.length})` : ''}
          </h2>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  statusFilter === s ? 'bg-navy text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredCodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No {statusFilter === 'all' ? '' : statusFilter} codes — mint one above.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Batched (unique) groups */}
            {[...groups.byBatch.entries()].map(([batchId, rows]) => {
              const active = rows.filter((r) => r.status === 'active')
              const redeemed = rows.reduce((s, r) => s + r.redemptions_used, 0)
              return (
                <div key={batchId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-navy">{rows[0].label ?? 'Unlabelled batch'}</p>
                      <p className="text-xs text-slate-500">
                        {rows.length} unique code{rows.length === 1 ? '' : 's'} · {redeemed}/{rows.length} redeemed · {rows[0].credits_per_redemption} credits each
                      </p>
                    </div>
                    {active.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleBatchRevoke(batchId)}
                        disabled={!!revoking}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                      >
                        {revoking === batchId ? 'Revoking…' : `Revoke batch (${active.length} active)`}
                      </button>
                    )}
                  </div>
                  <CodeTable
                    rows={rows}
                    expandedCode={expandedCode}
                    redemptionsByCode={redemptionsByCode}
                    revoking={revoking}
                    onToggleExpand={toggleExpand}
                    onRevoke={handleRevoke}
                  />
                </div>
              )
            })}

            {/* Standalone / shared codes */}
            {groups.standalone.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {groups.byBatch.size > 0 && (
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shared codes
                  </div>
                )}
                <CodeTable
                  rows={groups.standalone}
                  expandedCode={expandedCode}
                  redemptionsByCode={redemptionsByCode}
                  revoking={revoking}
                  onToggleExpand={toggleExpand}
                  onRevoke={handleRevoke}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CodeTable({
  rows,
  expandedCode,
  redemptionsByCode,
  revoking,
  onToggleExpand,
  onRevoke,
}: {
  rows: CodeRow[]
  expandedCode: string | null
  redemptionsByCode: Record<string, RedemptionEvent[]>
  revoking: string | null
  onToggleExpand: (id: string) => void
  onRevoke: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Credits</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Redeemed</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Expires</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((c) => (
            <Fragment key={c.id}>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleExpand(c.id)}
                    className="font-mono tracking-widest text-navy hover:underline"
                  >
                    {c.display_code}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{c.credits_per_redemption}</td>
                <td className="px-4 py-3 text-right text-slate-700">{c.redemptions_used}/{c.max_redemptions}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(c.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => onRevoke(c.id)}
                      disabled={!!revoking}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      {revoking === c.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
              {expandedCode === c.id && (
                <tr>
                  <td colSpan={6} className="bg-slate-50 px-4 py-3">
                    {c.note && <p className="mb-2 text-xs text-slate-500">Note: {c.note}</p>}
                    {!redemptionsByCode[c.id] ? (
                      <p className="text-xs text-slate-400">Loading redemptions…</p>
                    ) : redemptionsByCode[c.id].length === 0 ? (
                      <p className="text-xs text-slate-400">No redemptions yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {redemptionsByCode[c.id].map((r, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            {r.candidate_name ?? 'Unnamed candidate'} — {r.credits_granted} credit{r.credits_granted === 1 ? '' : 's'} — {new Date(r.redeemed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

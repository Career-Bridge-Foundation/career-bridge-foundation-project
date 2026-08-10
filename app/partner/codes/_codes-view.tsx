'use client'

import { useState } from 'react'
import type { AllocationState } from '@/lib/entitlement/ceiling'

export type CodeRow = {
  id: string
  code: string
  credits_per_redemption: number
  max_redemptions: number
  redemptions_used: number
  cohort_id: string | null
  expires_at: string
  created_at: string
  revoked_at: string | null
  reserved_value: number
  status: 'active' | 'expired' | 'exhausted' | 'revoked'
}

const STATUS_STYLES: Record<CodeRow['status'], string> = {
  active:    'bg-teal/10 text-teal',
  expired:   'bg-slate-100 text-slate-500',
  exhausted: 'bg-amber-50 text-amber-700',
  revoked:   'bg-red-50 text-red-600',
}

export function CodesView({
  allocation: initialAllocation,
  initialCodes,
}: {
  allocation: AllocationState
  initialCodes: CodeRow[]
}) {
  const [codes, setCodes]   = useState<CodeRow[]>(initialCodes)
  const [alloc, setAlloc]   = useState<AllocationState>(initialAllocation)
  const [cpr, setCpr]       = useState('')
  const [maxRed, setMaxRed] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [minting, setMinting]     = useState(false)
  const [mintError, setMintError] = useState<string | null>(null)
  const [revoking, setRevoking]   = useState<string | null>(null)

  const cprNum         = parseInt(cpr) || 0
  const maxRedNum      = parseInt(maxRed) || 0
  const reservedPreview = cprNum * maxRedNum
  const wouldExceed    = reservedPreview > 0 && reservedPreview > alloc.remaining
  const today          = new Date().toISOString().split('T')[0]

  async function refreshAllocation() {
    try {
      const res = await fetch('/api/partner/allocation')
      if (res.ok) setAlloc(await res.json())
    } catch { /* ignore — stale display is acceptable */ }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    if (minting) return
    setMinting(true)
    setMintError(null)
    try {
      const res  = await fetch('/api/partner/codes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          credits_per_redemption: cprNum,
          max_redemptions:        maxRedNum,
          expires_at:             new Date(expiresAt).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMintError(data.error ?? 'Something went wrong.')
        return
      }
      const newCode: CodeRow = {
        ...data.code,
        redemptions_used: 0,
        status: 'active',
      }
      setCodes((prev) => [newCode, ...prev])
      setCpr('')
      setMaxRed('')
      setExpiresAt('')
      await refreshAllocation()
    } finally {
      setMinting(false)
    }
  }

  async function handleRevoke(codeId: string) {
    if (revoking) return
    setRevoking(codeId)
    try {
      const res = await fetch(`/api/partner/codes/${codeId}/revoke`, { method: 'POST' })
      if (res.ok) {
        setCodes((prev) =>
          prev.map((c) =>
            c.id === codeId
              ? { ...c, revoked_at: new Date().toISOString(), status: 'revoked' }
              : c,
          ),
        )
        await refreshAllocation()
      }
    } finally {
      setRevoking(null)
    }
  }

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

  return (
    <div className="space-y-8">

      {/* Allocation banner */}
      <div className={`rounded-lg border p-5 ${bannerBorder}`}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Credit ceiling</p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-2xl font-bold text-navy">{alloc.consumed}</span>
          <span className="text-sm text-slate-600">
            of {alloc.committed} committed credits consumed
          </span>
          <span className="text-sm text-slate-400">
            {alloc.remaining} headroom remaining (hard ceiling: {alloc.hardCeiling})
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
        <p className="mt-2 text-xs text-slate-400">
          Reserved by outstanding codes: {alloc.reserved} credit{alloc.reserved === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Mint form */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-navy">Mint a new code</h2>
        <form onSubmit={handleMint} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Credits per redemption
              </label>
              <input
                type="number"
                min={1}
                value={cpr}
                onChange={(e) => setCpr(e.target.value)}
                placeholder="1"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Max redemptions
              </label>
              <input
                type="number"
                min={1}
                value={maxRed}
                onChange={(e) => setMaxRed(e.target.value)}
                placeholder="25"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Expires on
              </label>
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

          {reservedPreview > 0 && (
            <p className={`text-sm ${wouldExceed ? 'font-medium text-red-600' : 'text-slate-600'}`}>
              Reserved value:{' '}
              <strong>{reservedPreview} credit{reservedPreview === 1 ? '' : 's'}</strong>
              {wouldExceed
                ? ` — exceeds your remaining headroom of ${alloc.remaining}`
                : ` of ${alloc.remaining} available`}
            </p>
          )}

          {mintError && (
            <p className="text-xs text-red-600">{mintError}</p>
          )}

          <button
            type="submit"
            disabled={minting || wouldExceed || !cpr || !maxRed || !expiresAt}
            className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {minting ? 'Minting…' : 'Mint code'}
          </button>
        </form>
      </div>

      {/* Codes list */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-navy">
          Your codes{codes.length > 0 ? ` (${codes.length})` : ''}
        </h2>
        {codes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No codes yet — mint your first code above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono tracking-widest text-navy">
                      {c.code.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {c.credits_per_redemption}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {c.redemptions_used}/{c.max_redemptions}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(c.expires_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(c.id)}
                          disabled={!!revoking}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          {revoking === c.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

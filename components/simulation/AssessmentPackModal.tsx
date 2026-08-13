'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from '@/components/ui/Dialog'

const CREDIT_UNLOCKS = [
  'The scenario brief and task set',
  'AI Simulation Assistant',
  'AI competency assessment and detailed feedback',
  'Readiness Score',
  'AI Voice Debrief',
  'Portfolio evidence publication',
  'Digitally verifiable credential',
  'CV and LinkedIn script generation',
]

type Balance = { total: number; fungible: number; cohortScoped: Record<string, number> }

type PackOption = { pack: 'builder' | 'professional'; label: string; credits: number; amount: number | null; currency: string }

// Modal state machine
type Mode =
  | 'loading'
  | 'balance_first'   // has credits, first activation — show full T&C acceptance
  | 'balance_repeat'  // has credits, terms already accepted — brief confirmation only
  | 'no_balance'      // no credits — show sponsor code entry + buy-credits option
  | 'redeeming'       // submitting a sponsor code
  | 'activating'      // calling activate endpoint

const CODE_ERROR_MESSAGES: Record<string, string> = {
  already_redeemed: 'This code has already been applied to your account.',
  code_exhausted:   'This code has been fully redeemed.',
  code_expired:     'This code has expired.',
  code_revoked:     'This code is no longer valid.',
  invalid_code:     'Invalid code — check the spelling and try again.',
}

const ACTIVATE_ERROR_MESSAGES: Record<string, string> = {
  insufficient_balance:  'You have no credits available.',
  practice_simulation:   'This simulation does not require a credit.',
  simulation_not_found:  'Simulation not found.',
}

function formatPackPrice(amount: number | null, currency: string): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)
}

export interface AssessmentPackModalProps {
  open: boolean
  /** Called when the candidate chooses to go back without activating. */
  onClose: () => void
  /** Called after a successful activation — passes the activation_id. */
  onActivated: (activationId: string) => void
  simulationId: string
  simulationTitle: string
  cohortId?: string
  /** Relative path to return to once a credit purchase completes and activation succeeds. */
  returnTo?: string
}

export function AssessmentPackModal({
  open,
  onClose,
  onActivated,
  simulationId,
  simulationTitle,
  cohortId,
  returnTo,
}: AssessmentPackModalProps) {
  const [mode, setMode]               = useState<Mode>('loading')
  const [balance, setBalance]         = useState<Balance | null>(null)
  const [termsChecked, setTerms]      = useState(false)
  const [consentChecked, setConsent]  = useState(false)
  const [code, setCode]               = useState('')
  const [codeError, setCodeError]     = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  // ── Buy-credits sub-state (no_balance mode only) ──
  const [packs, setPacks]                       = useState<PackOption[]>([])
  const [packsError, setPacksError]             = useState<string | null>(null)
  const [selectedPack, setSelectedPack]         = useState<PackOption['pack'] | null>(null)
  const [purchaseTermsChecked, setPurchaseTerms]     = useState(false)
  const [purchaseConsentChecked, setPurchaseConsent] = useState(false)
  const [purchasing, setPurchasing]             = useState(false)
  const [purchaseError, setPurchaseError]       = useState<string | null>(null)

  const fetchPacks = useCallback(async () => {
    setPacksError(null)
    try {
      const res  = await fetch('/api/candidate/packs')
      const data = await res.json()
      if (!res.ok) {
        setPacksError(data.error ?? 'Unable to load credit packs right now.')
        return
      }
      setPacks(data.packs)
      setSelectedPack((current) => current ?? data.packs[0]?.pack ?? null)
    } catch {
      setPacksError('Unable to load credit packs right now.')
    }
  }, [])

  const fetchEntitlement = useCallback(async () => {
    setMode('loading')
    try {
      const res  = await fetch('/api/candidate/entitlement')
      const data = await res.json()
      setBalance(data.balance)
      if (!res.ok || data.balance.total === 0) {
        setMode('no_balance')
        fetchPacks()
      } else {
        setMode(data.termsAccepted ? 'balance_repeat' : 'balance_first')
      }
    } catch {
      setMode('no_balance') // fail-open: show code entry rather than a blank modal
      fetchPacks()
    }
  }, [fetchPacks])

  useEffect(() => {
    if (open) {
      setTerms(false)
      setConsent(false)
      setCode('')
      setCodeError(null)
      setActivateError(null)
      setPacks([])
      setPacksError(null)
      setSelectedPack(null)
      setPurchaseTerms(false)
      setPurchaseConsent(false)
      setPurchasing(false)
      setPurchaseError(null)
      fetchEntitlement()
    }
  }, [open, fetchEntitlement])

  async function handleRedeem() {
    if (!code.trim() || mode === 'redeeming') return
    setMode('redeeming')
    setCodeError(null)
    try {
      const res  = await fetch('/api/candidate/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCodeError(CODE_ERROR_MESSAGES[data.code] ?? 'Invalid code — check the spelling and try again.')
        setMode('no_balance')
        return
      }
      setCode('')
      await fetchEntitlement() // re-fetch so mode updates to balance_first/repeat
    } catch {
      setCodeError('Something went wrong. Please try again.')
      setMode('no_balance')
    }
  }

  async function handleActivate() {
    if (mode === 'activating') return
    setMode('activating')
    setActivateError(null)
    try {
      const res  = await fetch('/api/candidate/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation_id: simulationId,
          cohort_id: cohortId ?? null,
          immediate_performance_consent: consentChecked,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        onActivated(data.activation_id)
        return
      }
      setActivateError(ACTIVATE_ERROR_MESSAGES[data.code] ?? 'Something went wrong. Please try again.')
      await fetchEntitlement()
    } catch {
      setActivateError('Something went wrong. Please try again.')
      await fetchEntitlement()
    }
  }

  async function handlePurchase() {
    if (!selectedPack || purchasing) return
    setPurchasing(true)
    setPurchaseError(null)
    try {
      const res  = await fetch('/api/candidate/checkout-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack: selectedPack,
          terms_accepted: purchaseTermsChecked,
          immediate_performance_consent: purchaseConsentChecked,
          simulation_id: simulationId,
          cohort_id: cohortId ?? null,
          return_to: returnTo ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setPurchaseError(data.error ?? 'Something went wrong. Please try again.')
        setPurchasing(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPurchaseError('Something went wrong. Please try again.')
      setPurchasing(false)
    }
  }

  const isActivating    = mode === 'activating'
  const showCodeEntry   = mode === 'no_balance' || mode === 'redeeming'
  const showActions     = mode === 'balance_first' || mode === 'balance_repeat' || mode === 'activating'
  const canConfirm      = mode === 'balance_first' ? termsChecked && consentChecked : true
  const canPurchase     = !!selectedPack && purchaseTermsChecked && purchaseConsentChecked && !purchasing

  return (
    <Dialog open={open} onClose={isActivating ? () => {} : onClose}>
      <div className="space-y-5">

        {/* ── Header ── */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal">
            Assessed simulation
          </p>
          <h2 className="text-lg font-bold leading-snug text-navy">{simulationTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            This is an assessed workplace simulation. Your responses are evaluated by AI against
            professional competency standards and produce a verified credential.
          </p>
        </div>

        {mode === 'loading' ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 w-3/4 rounded bg-slate-100" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
            <div className="h-4 w-2/3 rounded bg-slate-100" />
          </div>
        ) : (
          <>
            {/* ── What one credit unlocks ── */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                One credit unlocks
              </p>
              <ul className="space-y-1.5">
                {CREDIT_UNLOCKS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Credit cost statement ── */}
            <p className="text-sm font-medium text-navy">
              Proceeding uses one Assessment Credit.{' '}
              {balance && balance.total > 0 && (
                <span className="font-normal text-slate-500">
                  You have {balance.total} credit{balance.total === 1 ? '' : 's'} available.
                </span>
              )}
            </p>

            {/* ── Sponsor code entry (no-balance variant) ── */}
            {showCodeEntry && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Enter a sponsor code from your programme partner:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem() }}
                    placeholder="XXXX-XXXX"
                    disabled={mode === 'redeeming'}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-navy/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleRedeem}
                    disabled={!code.trim() || mode === 'redeeming'}
                    className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {mode === 'redeeming' ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {codeError && (
                  <p className="text-xs text-red-600">{codeError}</p>
                )}
                <p className="text-xs text-slate-400">
                  Don't have a code? Contact your programme partner — not Evidentize.
                </p>
              </div>
            )}

            {/* ── Buy a credit pack (no-balance variant) ── */}
            {mode === 'no_balance' && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">Or buy an Assessment Pack:</p>

                {packsError && (
                  <p className="text-xs text-red-600">{packsError}</p>
                )}

                {!packsError && packs.length === 0 && (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-9 rounded bg-slate-100" />
                    <div className="h-9 rounded bg-slate-100" />
                  </div>
                )}

                {packs.length > 0 && (
                  <div className="space-y-2">
                    {packs.map((p) => (
                      <label
                        key={p.pack}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-2 has-[:checked]:border-navy has-[:checked]:bg-navy/5"
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="pack"
                            checked={selectedPack === p.pack}
                            onChange={() => setSelectedPack(p.pack)}
                            className="h-4 w-4 accent-navy"
                          />
                          <span className="text-sm text-slate-700">
                            <span className="font-medium">{p.label}</span> — {p.credits} credit{p.credits === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-navy">
                          {formatPackPrice(p.amount, p.currency)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {packs.length > 0 && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={purchaseTermsChecked}
                        onChange={(e) => setPurchaseTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy"
                      />
                      <span className="text-sm text-slate-700">
                        I have read and accept the{' '}
                        <a
                          href="/legal/terms/v1"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-navy underline underline-offset-2"
                        >
                          Terms &amp; Conditions
                        </a>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={purchaseConsentChecked}
                        onChange={(e) => setPurchaseConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy"
                      />
                      <span className="text-sm text-slate-700">
                        I consent to my performance being evaluated by AI immediately after purchase.
                      </span>
                    </label>

                    {purchaseError && (
                      <p className="text-xs text-red-600">{purchaseError}</p>
                    )}

                    <button
                      type="button"
                      onClick={handlePurchase}
                      disabled={!canPurchase}
                      className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {purchasing ? 'Redirecting to payment…' : 'Continue to payment'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Terms acceptance (first activation only) ── */}
            {mode === 'balance_first' && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => setTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy"
                  />
                  <span className="text-sm text-slate-700">
                    I have read and accept the{' '}
                    <a
                      href="/legal/terms/v1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-navy underline underline-offset-2"
                    >
                      Terms &amp; Conditions
                    </a>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy"
                  />
                  <span className="text-sm text-slate-700">
                    I consent to my performance being evaluated by AI and the results being shared
                    with my programme partner.
                  </span>
                </label>
              </div>
            )}

            {activateError && (
              <p className="text-xs text-red-600">{activateError}</p>
            )}

            {/* ── Actions ── */}
            {showActions && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isActivating}
                  className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={!canConfirm || isActivating}
                  className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {isActivating ? 'Activating…' : 'Use 1 credit and begin'}
                </button>
              </div>
            )}

            {/* Go back link for no-balance variant */}
            {mode === 'no_balance' && (
              <div className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Go back
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}

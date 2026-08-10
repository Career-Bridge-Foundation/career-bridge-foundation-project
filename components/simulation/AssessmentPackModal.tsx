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

// Modal state machine
type Mode =
  | 'loading'
  | 'balance_first'   // has credits, first activation — show full T&C acceptance
  | 'balance_repeat'  // has credits, terms already accepted — brief confirmation only
  | 'no_balance'      // no credits — show sponsor code entry
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

export interface AssessmentPackModalProps {
  open: boolean
  /** Called when the candidate chooses to go back without activating. */
  onClose: () => void
  /** Called after a successful activation — passes the activation_id. */
  onActivated: (activationId: string) => void
  simulationId: string
  simulationTitle: string
  cohortId?: string
}

export function AssessmentPackModal({
  open,
  onClose,
  onActivated,
  simulationId,
  simulationTitle,
  cohortId,
}: AssessmentPackModalProps) {
  const [mode, setMode]               = useState<Mode>('loading')
  const [balance, setBalance]         = useState<Balance | null>(null)
  const [termsChecked, setTerms]      = useState(false)
  const [consentChecked, setConsent]  = useState(false)
  const [code, setCode]               = useState('')
  const [codeError, setCodeError]     = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  const fetchEntitlement = useCallback(async () => {
    setMode('loading')
    try {
      const res  = await fetch('/api/candidate/entitlement')
      const data = await res.json()
      setBalance(data.balance)
      if (!res.ok || data.balance.total === 0) {
        setMode('no_balance')
      } else {
        setMode(data.termsAccepted ? 'balance_repeat' : 'balance_first')
      }
    } catch {
      setMode('no_balance') // fail-open: show code entry rather than a blank modal
    }
  }, [])

  useEffect(() => {
    if (open) {
      setTerms(false)
      setConsent(false)
      setCode('')
      setCodeError(null)
      setActivateError(null)
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

  const isActivating    = mode === 'activating'
  const showCodeEntry   = mode === 'no_balance' || mode === 'redeeming'
  const showActions     = mode === 'balance_first' || mode === 'balance_repeat' || mode === 'activating'
  const canConfirm      = mode === 'balance_first' ? termsChecked && consentChecked : true

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

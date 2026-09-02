'use client'
import React, { useState } from 'react'
import { grantableDisciplines } from '@/lib/disciplines-data'
import { COUNTRIES } from '@/lib/countries'
import { getPricingRegion, getPresentmentCurrency } from '@/lib/entitlement/pricingRegion'
import { FOUNDING_COHORT_PER_CREDIT, PRICING_REGION_LABEL } from '@/lib/entitlement/foundingCohortPricing'

const AVAILABLE = grantableDisciplines

type Result = {
  redemption_url: string
  expires_at: string
}

export function MintForm({ hasActiveProgrammeTerms }: { hasActiveProgrammeTerms: boolean }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [includeProgrammeTerms, setIncludeProgrammeTerms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  // Inline pricing consequence — Amendment §Console UI: a bare dropdown gives
  // no signal that a pricing decision was just made on someone's behalf.
  const pricingPreview = country
    ? (() => {
        const region = getPricingRegion(country)
        const currency = getPresentmentCurrency(country)
        const perCredit = FOUNDING_COHORT_PER_CREDIT[region]
        const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? country
        return `${countryName} — ${PRICING_REGION_LABEL[region]} pricing, $${perCredit.toFixed(2)} per credit, shown in ${currency}.`
      })()
    : null

  function toggleDiscipline(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    )
  }

  async function handleSubmit() {
    setError(null)
    if (!email.trim()) {
      setError('Candidate email is required.')
      return
    }
    if (selected.length === 0) {
      setError('Select at least one discipline.')
      return
    }
    if (!country) {
      setError('Select the candidate\'s country — this sets their pricing and cannot default.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/partner/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_email: email.trim(),
          candidate_name: name.trim() || undefined,
          country,
          disciplines: selected,
          requires_programme_terms: hasActiveProgrammeTerms ? includeProgrammeTerms : false,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ? `Could not generate link: ${data.error}` : 'Could not generate link.')
        setSubmitting(false)
        return
      }
      setResult({ redemption_url: data.redemption_url, expires_at: data.expires_at })
      setSubmitting(false)
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.redemption_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select and copy the link manually.')
    }
  }

  function reset() {
    setEmail('')
    setName('')
    setCountry('')
    setSelected([])
    setIncludeProgrammeTerms(true)
    setResult(null)
    setError(null)
    setCopied(false)
  }

  const expiryLabel = result
    ? new Date(result.expires_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  if (result) {
    return (
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Invite created</h2>
        <p className="text-sm text-slate-500 mb-4">
          We&apos;ve emailed the invite to {email}. You can also copy the link below to share it another way. Expires {expiryLabel}.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={result.redemption_url}
            className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={handleCopy}
            className="rounded-md bg-[#006FAD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005a8c]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <button
          onClick={reset}
          className="mt-4 text-sm font-semibold text-[#006FAD] hover:underline"
        >
          Provision another candidate
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Provision a candidate</h2>

      <label className="block text-sm font-medium text-slate-700 mb-1">
        Candidate email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="candidate@example.com"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-4"
      />

      <label className="block text-sm font-medium text-slate-700 mb-1">
        Candidate name <span className="text-slate-400 font-normal">(optional)</span>
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-4"
      />

      <label className="block text-sm font-medium text-slate-700 mb-1">
        Candidate&apos;s country
      </label>
      <p className="text-xs text-slate-400 mb-1.5">
        Used to determine pricing shown to this candidate. Set from what you know of them at admission — not self-reported.
      </p>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-1 bg-white"
      >
        <option value="">Select a country…</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
      {pricingPreview ? (
        <p className="text-xs text-[#006FAD] mb-4">{pricingPreview}</p>
      ) : (
        <p className="text-xs text-slate-400 mb-4">
          Sets the candidate&apos;s pricing tier and currency. No default — required before this invite can be sent.
        </p>
      )}

      <label className="block text-sm font-medium text-slate-700 mb-2">
        Disciplines
      </label>
      <div className="space-y-2 mb-4">
        {AVAILABLE.map((d) => (
          <label key={d.slug} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(d.name)}
              onChange={() => toggleDiscipline(d.name)}
            />
            {d.name}
          </label>
        ))}
      </div>

      {hasActiveProgrammeTerms ? (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeProgrammeTerms}
              onChange={(e) => setIncludeProgrammeTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Include your programme terms for this candidate
              <span className="block text-xs text-slate-500">We recommend keeping this checked.</span>
            </span>
          </label>
        </div>
      ) : (
        <p className="mb-4 text-xs text-slate-400">
          You haven&apos;t published programme terms yet — this candidate will only see Evidentize&apos;s platform terms.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !country}
        className="rounded-md bg-[#003359] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00253f] disabled:opacity-50"
      >
        {submitting ? 'Generating…' : 'Generate redemption link'}
      </button>
    </div>
  )
}

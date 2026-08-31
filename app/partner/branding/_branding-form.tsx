'use client'
import { useState } from 'react'
import { isValidHexColor } from '@/lib/validation/hexColor'

const DEFAULT_PRIMARY = '#18284e'
const DEFAULT_SECONDARY = '#0d9488'

export function BrandingForm({
  initialPrimary,
  initialSecondary,
  brandedUrl,
}: {
  initialPrimary: string
  initialSecondary: string | null
  brandedUrl: string | null
}) {
  const [primary, setPrimary] = useState(initialPrimary)
  const [secondary, setSecondary] = useState(initialSecondary ?? '') // '' === cleared (null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const primaryValid = isValidHexColor(primary)
  const secondaryCleared = secondary.trim() === ''
  const secondaryValid = secondaryCleared || isValidHexColor(secondary)
  const canSave = primaryValid && secondaryValid && !saving

  const previewPrimary = primaryValid ? primary : DEFAULT_PRIMARY
  const previewSecondary = !secondaryCleared && isValidHexColor(secondary) ? secondary : DEFAULT_SECONDARY

  async function handleSave() {
    setError(null)
    setSaved(false)
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch('/api/partner/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: primary,
          secondary_color: secondaryCleared ? null : secondary,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Could not save branding.')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Live preview */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: previewPrimary }}>
            <span className="text-sm font-semibold text-white">Your brand</span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: previewSecondary }}
            >
              Distinction
            </span>
          </div>
          <div className="px-4 py-3 text-xs text-slate-500">Sample header and accent chip in your colours.</div>
        </div>
      </div>

      {/* Color inputs */}
      <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
        <ColorField
          label="Primary colour"
          hint="Used for headers and primary actions. Required."
          value={primary}
          onChange={(v) => { setPrimary(v); setSaved(false) }}
          invalid={!primaryValid}
          invalidMsg="Enter a valid hex colour, e.g. #18284e"
        />
        <div>
          <ColorField
            label="Secondary colour"
            hint="Accent colour. Optional."
            value={secondary}
            onChange={(v) => { setSecondary(v); setSaved(false) }}
            invalid={!secondaryValid}
            invalidMsg="Enter a valid hex colour or clear it"
            placeholder="(none)"
          />
          {!secondaryCleared && (
            <button
              type="button"
              onClick={() => { setSecondary(''); setSaved(false) }}
              className="mt-1 text-xs font-medium text-teal hover:underline"
            >
              Clear secondary colour
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save colours'}
        </button>
        <p className="text-xs text-slate-400">Changes can take up to a minute to appear on your branded pages.</p>
      </div>

      {/* Read-only subdomain */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Branded URL</p>
        <p className="mt-1 font-mono text-sm text-slate-700">{brandedUrl ?? 'Not assigned yet'}</p>
        <p className="mt-1 text-xs text-slate-400">Your branded URL — contact us to change it.</p>
      </div>
    </div>
  )
}

function ColorField({
  label, hint, value, onChange, invalid, invalidMsg, placeholder,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  invalid: boolean
  invalidMsg: string
  placeholder?: string
}) {
  const swatch = isValidHexColor(value) && value.length === 7 ? value : '#ffffff'
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <p className="mb-1.5 text-xs text-slate-400">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '#18284e'}
          className={`w-40 rounded-md border px-3 py-2 font-mono text-sm ${invalid ? 'border-red-300' : 'border-slate-300'}`}
        />
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600">{invalidMsg}</p>}
    </div>
  )
}

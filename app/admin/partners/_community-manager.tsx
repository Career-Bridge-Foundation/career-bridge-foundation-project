'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORTED_COMMUNITY_PROVIDERS } from '@/lib/partners/communityProviders'

type Partner = {
  id: string
  name: string
  community_provider: string | null
  community_url: string | null
  community_space_id: string | null
  community_enabled: boolean
  community_credential_last4: string | null
}

export function CommunityManager({ partners }: { partners: Partner[] }) {
  const [selectedId, setSelectedId] = useState(partners[0]?.id ?? '')
  const selected = partners.find((p) => p.id === selectedId) ?? null

  if (partners.length === 0) {
    return <p className="text-sm text-slate-400">No partner organisations exist yet.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Partner
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.community_enabled ? '· enabled' : ''}
            </option>
          ))}
        </select>
      </div>

      {selected && <PartnerCommunityForm key={selected.id} partner={selected} />}
    </div>
  )
}

function PartnerCommunityForm({ partner }: { partner: Partner }) {
  const router = useRouter()
  const [provider, setProvider] = useState(partner.community_provider ?? '')
  const [url, setUrl] = useState(partner.community_url ?? '')
  const [spaceId, setSpaceId] = useState(partner.community_space_id ?? '')
  const [enabled, setEnabled] = useState(partner.community_enabled)
  const [credential, setCredential] = useState('') // always starts blank — see rotation note below
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setProvider(partner.community_provider ?? '')
    setUrl(partner.community_url ?? '')
    setSpaceId(partner.community_space_id ?? '')
    setEnabled(partner.community_enabled)
    setCredential('')
    setSaved(false)
  }, [partner])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}/community`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          community_provider: provider.trim() || null,
          community_url: url.trim() || null,
          community_space_id: spaceId.trim() || null,
          community_enabled: enabled,
          // Only send `credential` if the admin actually typed something —
          // an empty field means "leave the stored one alone," not "clear it."
          ...(credential ? { credential } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not save.')
        setSaving(false)
        return
      }
      setCredential('')
      setSaved(true)
      setSaving(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Community provisioning enabled for {partner.name}
      </label>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Not configured</option>
          {SUPPORTED_COMMUNITY_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Only providers with a real integration path are listed — see lib/partners/communityProviders.ts.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Community URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://careerbridge.circle.so"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-400">This is the link candidates are shown once they're provisioned.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Cohort space ID
        </label>
        <input
          type="text"
          value={spaceId}
          onChange={(e) => setSpaceId(e.target.value)}
          placeholder="the space candidates get added to"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Admin API credential
        </label>
        <input
          type="password"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder={partner.community_credential_last4 ? `Configured, ending in ${partner.community_credential_last4} — leave blank to keep it` : 'Not configured'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-400">
          Encrypted at rest, never shown again once saved. Leave blank to keep the current one — this field is
          also the rotation path: typing a new value here and saving replaces it.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

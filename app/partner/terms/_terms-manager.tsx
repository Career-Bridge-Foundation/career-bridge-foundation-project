'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PublishForm } from './_publish-form'
import { VersionHistory, type PartnerTermsDoc } from './_version-history'

export function TermsManager({ docs, communityUrl }: { docs: PartnerTermsDoc[]; communityUrl: string }) {
  const active = docs.find((d) => d.is_active) ?? null

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
          {active ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal">
                Active
              </span>
              <span className="text-sm font-medium text-slate-900">v{active.version}</span>
              <span className="text-xs text-slate-400">
                published {new Date(active.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {active.source_file_type ? ` · ${active.source_file_type.toUpperCase()}` : ' · text'}
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No programme terms published — candidates you provision only see Evidentize&apos;s platform terms.
            </p>
          )}
        </div>

        <div className="mb-4">
          <PublishForm currentVersion={active?.version ?? null} />
        </div>

        <VersionHistory docs={docs} />
      </section>

      <section>
        <CommunityUrlForm initialUrl={communityUrl} />
      </section>
    </div>
  )
}

function CommunityUrlForm({ initialUrl }: { initialUrl: string }) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/partner/community-url', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ community_url: url.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not save.')
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Community invite link</h2>
      <p className="text-sm text-slate-500">
        A link to your own community (e.g. a Circle invite link) — shown directly to candidates once they've
        completed acceptance. Leave blank if you don&apos;t have a community to share.
      </p>
      <input
        type="text"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setSaved(false); setError(null) }}
        placeholder="https://your-community.circle.so/invite/..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
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

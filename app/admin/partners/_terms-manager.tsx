'use client'
import { useMemo } from 'react'
import { PublishForm } from './_publish-form'
import { VersionHistory, type TermsDoc } from './_version-history'

/**
 * Platform terms ONLY — partner programme terms are now authored by the
 * partner themselves on their own dashboard (app/partner/terms/page.tsx),
 * not published on their behalf here. One document, one version history,
 * identical for every candidate regardless of partner.
 */
export function TermsManager({ docs }: { docs: TermsDoc[] }) {
  const platformDocs = useMemo(
    () => docs.filter((d) => d.document_type === 'platform_terms'),
    [docs]
  )
  const platformActive = platformDocs.find((d) => d.is_active) ?? null

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-900">Evidentize platform terms</h2>
        <p className="text-sm text-slate-500">
          Platform licence, portfolio publication, credential issuance, data processing. Identical for every
          candidate regardless of partner — one document, one version history.
        </p>
      </div>

      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
        {platformActive ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal">
              Active
            </span>
            <span className="text-sm font-medium text-slate-900">v{platformActive.version}</span>
            <span className="text-xs text-slate-400">
              published {new Date(platformActive.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            No active version — candidates are not currently gated on the platform terms at all.
          </p>
        )}
      </div>

      <div className="mb-4">
        <PublishForm
          documentType="platform_terms"
          partnerId={null}
          currentVersion={platformActive?.version ?? null}
        />
      </div>

      <VersionHistory docs={platformDocs} />
    </section>
  )
}

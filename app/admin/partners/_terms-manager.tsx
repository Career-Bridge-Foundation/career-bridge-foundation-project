'use client'
import { useMemo, useState } from 'react'
import { PublishForm } from './_publish-form'
import { VersionHistory, type TermsDoc } from './_version-history'

type Partner = { id: string; name: string; slug: string }

/**
 * Spec 19 decision 1, kept structural in the UI: platform terms and partner
 * programme terms are two entirely separate sections below, never one form
 * with a type switch. Selecting a different partner only ever changes which
 * partner's OWN document you're looking at — it can never accidentally
 * publish that text as the neutral platform document, and vice versa.
 */
export function TermsManager({ docs, partners }: { docs: TermsDoc[]; partners: Partner[] }) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(partners[0]?.id ?? '')

  const platformDocs = useMemo(
    () => docs.filter((d) => d.document_type === 'platform_terms'),
    [docs]
  )
  const platformActive = platformDocs.find((d) => d.is_active) ?? null

  const programmeDocsForSelected = useMemo(
    () => docs.filter((d) => d.document_type === 'partner_programme_terms' && d.partner_id === selectedPartnerId),
    [docs, selectedPartnerId]
  )
  const programmeActive = programmeDocsForSelected.find((d) => d.is_active) ?? null
  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) ?? null

  return (
    <div className="space-y-10">
      {/* ── Evidentize platform terms — partner-neutral, one version history ── */}
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

      {/* ── Partner programme terms — one independent document per partner ── */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-slate-900">Partner programme terms</h2>
          <p className="text-sm text-slate-500">
            Cohort undertaking, community conduct, non-completion consequences, partner contact route. Authored
            by the partner and its solicitor — each partner has its own text and its own version history,
            never shared with another partner&apos;s.
          </p>
        </div>

        {partners.length === 0 ? (
          <p className="text-sm text-slate-400">No partner organisations exist yet.</p>
        ) : (
          <>
            <div className="mb-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Partner
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
              {programmeActive ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs font-medium text-teal">
                    Active
                  </span>
                  <span className="text-sm font-medium text-slate-900">v{programmeActive.version}</span>
                  <span className="text-xs text-slate-400">
                    published {new Date(programmeActive.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  {selectedPartner?.name ?? 'This partner'} has no active programme terms — candidates entitled
                  by them are never asked to accept anything for this partner, and provisioning new candidates
                  for them is blocked until a version is published.
                </p>
              )}
            </div>

            <div className="mb-4">
              <PublishForm
                key={selectedPartnerId}
                documentType="partner_programme_terms"
                partnerId={selectedPartnerId}
                currentVersion={programmeActive?.version ?? null}
              />
            </div>

            <VersionHistory docs={programmeDocsForSelected} />
          </>
        )}
      </section>
    </div>
  )
}

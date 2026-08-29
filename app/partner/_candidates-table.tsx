import Link from 'next/link'
import { disciplines } from '@/lib/disciplines-data'
import { highestVerdictBand } from '@/lib/portfolio/highestVerdictBand'
import type { PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { partnerVerdictStyle } from '@/lib/verdict-bands'
import { MarkProvisioned } from './_mark-provisioned'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))

export type CandidateStatus = 'Not started' | 'In progress' | 'Evaluated'
export type CandidateMeta = { started: number; evaluated: number; best: string | null; status: CandidateStatus }
export type SortKey = 'name' | 'progress' | 'verdict' | 'status'
export type SortState = { key: SortKey; dir: 'asc' | 'desc' }

/** Shared per-candidate derivation — used by the table (render) and the panel (filter/sort). */
export function candidateMeta(c: PartnerCandidateWithProgress): CandidateMeta {
  const started = c.simulations.length
  const evaluated = c.simulations.filter((s) => s.verdictBand).length
  const best = highestVerdictBand(c.simulations.map((s) => s.verdictBand).filter((b): b is string => !!b))
  const status: CandidateStatus = started === 0 ? 'Not started' : evaluated === 0 ? 'In progress' : 'Evaluated'
  return { started, evaluated, best, status }
}

const STATUS_STYLE: Record<CandidateStatus, string> = {
  'Not started': 'bg-slate-100 text-slate-500 border-slate-200',
  'In progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Evaluated: 'bg-teal/10 text-teal border-teal/30',
}

const PROVISIONING_STYLE: Record<string, string> = {
  not_required: 'bg-slate-100 text-slate-500 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  provisioned: 'bg-teal/10 text-teal border-teal/30',
  failed: 'bg-red-50 text-red-700 border-red-200',
}
const PROVISIONING_LABEL: Record<string, string> = {
  not_required: 'Not required',
  pending: 'Pending',
  provisioned: 'Provisioned',
  failed: 'Failed',
}

function Th({ label, sortKey, sort, onSort }: { label: string; sortKey?: SortKey; sort?: SortState; onSort?: (k: SortKey) => void }) {
  if (!sortKey || !onSort) return <th className="px-4 py-3 font-medium">{label}</th>
  const active = sort?.key === sortKey
  return (
    <th className="px-4 py-3 font-medium">
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-slate-700">
        {label}
        <span className="text-[9px] text-slate-400">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

export function CandidatesTable({
  candidates,
  sort,
  onSort,
  linkDetail = true,
  showAdminColumns = false,
  communityEnabled = false,
}: {
  candidates: PartnerCandidateWithProgress[]
  sort?: SortState
  onSort?: (k: SortKey) => void
  linkDetail?: boolean // false (mentor) → name is plain text, no link to the raw-submission detail
  showAdminColumns?: boolean // Terms/Community columns — partner-only administrative concern, not shown to mentors
  communityEnabled?: boolean // hides the Community column entirely for partners with no community configured
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <Th label="Candidate" sortKey="name" sort={sort} onSort={onSort} />
            <th className="px-4 py-3 font-medium">Disciplines</th>
            <Th label="Progress" sortKey="progress" sort={sort} onSort={onSort} />
            <Th label="Latest verdict" sortKey="verdict" sort={sort} onSort={onSort} />
            <Th label="Status" sortKey="status" sort={sort} onSort={onSort} />
            {showAdminColumns && <th className="px-4 py-3 font-medium">Terms</th>}
            {showAdminColumns && communityEnabled && <th className="px-4 py-3 font-medium">Community</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((c) => {
            const { started, evaluated, best, status } = candidateMeta(c)
            const termsAccepted = c.platformTermsAccepted && c.programmeTermsAccepted
            return (
              <tr key={c.candidateId} className="hover:bg-slate-50">
                <td className="px-4 py-3 align-top">
                  {linkDetail ? (
                    <Link href={`/partner/candidates/${c.candidateId}`} className="font-medium text-navy hover:underline">
                      {c.fullName ?? 'Unnamed candidate'}
                    </Link>
                  ) : (
                    <div className="font-medium text-slate-900">{c.fullName ?? 'Unnamed candidate'}</div>
                  )}
                  <div className="text-xs text-slate-500">{c.email ?? '—'}</div>
                  <Link href={`/portfolio/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-teal hover:underline">
                    Public portfolio ↗
                  </Link>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {c.disciplines.map((slug) => (
                      <span key={slug} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {DISCIPLINE_NAME.get(slug) ?? slug}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">
                  {started === 0 ? <span className="text-slate-400">—</span> : <span>{evaluated}/{started} evaluated</span>}
                </td>
                <td className="px-4 py-3 align-top">
                  {best ? (
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${partnerVerdictStyle(best)}`}>
                      {best}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
                    {status}
                  </span>
                </td>
                {showAdminColumns && (
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        termsAccepted ? 'bg-teal/10 text-teal border-teal/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {termsAccepted ? 'Accepted' : 'Pending'}
                    </span>
                  </td>
                )}
                {showAdminColumns && communityEnabled && (
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${PROVISIONING_STYLE[c.provisioningStatus] ?? PROVISIONING_STYLE.not_required}`}>
                      {PROVISIONING_LABEL[c.provisioningStatus] ?? c.provisioningStatus}
                    </span>
                    {(c.provisioningStatus === 'pending' || c.provisioningStatus === 'failed') && (
                      <div className="mt-1">
                        <MarkProvisioned candidateId={c.candidateId} />
                      </div>
                    )}
                    {c.provisioningStatus === 'provisioned' && c.communityMemberId && (
                      <p className="mt-1 text-[11px] text-slate-400">id: {c.communityMemberId}</p>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

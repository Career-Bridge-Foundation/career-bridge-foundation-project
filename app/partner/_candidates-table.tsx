import Link from 'next/link'
import { disciplines } from '@/lib/disciplines-data'
import { highestVerdictBand } from '@/lib/portfolio/highestVerdictBand'
import type { PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { partnerVerdictStyle } from '@/lib/verdict-bands'

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
}: {
  candidates: PartnerCandidateWithProgress[]
  sort?: SortState
  onSort?: (k: SortKey) => void
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((c) => {
            const { started, evaluated, best, status } = candidateMeta(c)
            return (
              <tr key={c.candidateId} className="hover:bg-slate-50">
                <td className="px-4 py-3 align-top">
                  <Link href={`/partner/candidates/${c.candidateId}`} className="font-medium text-navy hover:underline">
                    {c.fullName ?? 'Unnamed candidate'}
                  </Link>
                  <div className="text-xs text-slate-500">{c.email ?? '—'}</div>
                  <Link href={`/${c.slug}`} className="text-xs font-medium text-teal hover:underline">
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

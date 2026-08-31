'use client'
import { useMemo, useState } from 'react'
import { disciplines } from '@/lib/disciplines-data'
import type { PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { CandidatesTable, candidateMeta, type CandidateStatus, type SortKey, type SortState } from './_candidates-table'
import { VERDICT_BANDS, verdictRank } from '@/lib/verdict-bands'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))
const STATUSES: CandidateStatus[] = ['Not started', 'In progress', 'Evaluated']
const STATUS_RANK: Record<CandidateStatus, number> = { 'Not started': 0, 'In progress': 1, Evaluated: 2 }

const PAGE_SIZE = 20

export function CandidatesPanel({
  candidates,
  linkDetail = true,
  showAdminColumns = false,
}: {
  candidates: PartnerCandidateWithProgress[]
  linkDetail?: boolean
  showAdminColumns?: boolean
}) {
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const [status, setStatus] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of candidates) for (const d of c.disciplines) set.add(d)
    return [...set].sort((a, b) => (DISCIPLINE_NAME.get(a) ?? a).localeCompare(DISCIPLINE_NAME.get(b) ?? b))
  }, [candidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter((c) => {
      if (q && !`${c.fullName ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q)) return false
      if (discipline !== 'all' && !c.disciplines.includes(discipline)) return false
      const m = candidateMeta(c)
      if (status !== 'all' && m.status !== status) return false
      if (verdict === 'none') return !m.best
      if (verdict !== 'all' && m.best !== verdict) return false
      return true
    })
  }, [candidates, search, discipline, status, verdict])

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const ma = candidateMeta(a), mb = candidateMeta(b)
      let cmp = 0
      if (sort.key === 'name') cmp = (a.fullName ?? '').localeCompare(b.fullName ?? '')
      else if (sort.key === 'progress') cmp = ma.evaluated - mb.evaluated || ma.started - mb.started
      else if (sort.key === 'verdict') cmp = verdictRank(ma.best ?? '') - verdictRank(mb.best ?? '')
      else if (sort.key === 'status') cmp = STATUS_RANK[ma.status] - STATUS_RANK[mb.status]
      return cmp * dir
    })
  }, [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const changeFilter = (fn: () => void) => { fn(); setPage(1) }
  const resetFilters = () => { setSearch(''); setDiscipline('all'); setStatus('all'); setVerdict('all'); setPage(1) }
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const selectCls = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          placeholder="Search name or email…"
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select className={selectCls} value={discipline} onChange={(e) => changeFilter(() => setDiscipline(e.target.value))}>
          <option value="all">All disciplines</option>
          {disciplineOptions.map((slug) => <option key={slug} value={slug}>{DISCIPLINE_NAME.get(slug) ?? slug}</option>)}
        </select>
        <select className={selectCls} value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value))}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectCls} value={verdict} onChange={(e) => changeFilter(() => setVerdict(e.target.value))}>
          <option value="all">All verdicts</option>
          {VERDICT_BANDS.map((v) => <option key={v} value={v}>{v}</option>)}
          <option value="none">No verdict yet</option>
        </select>
      </div>

      <p className="text-xs text-slate-500">
        Showing {sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
        {sorted.length !== candidates.length ? ` (${candidates.length} provisioned)` : ' candidates'}
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-slate-900">No candidates match your filters</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Try a different search or filter combination.</p>
          <button onClick={resetFilters} className="mt-3 text-sm font-semibold text-teal hover:underline">Clear filters</button>
        </div>
      ) : (
        <CandidatesTable
          candidates={paged}
          sort={sort}
          onSort={toggleSort}
          linkDetail={linkDetail}
          showAdminColumns={showAdminColumns}
        />
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Prev</button>
          <span className="text-slate-600">Page {safePage} of {pageCount}</span>
          <button disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

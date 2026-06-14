import { disciplines } from '@/lib/disciplines-data'
import { verdictBarColor } from '@/lib/verdict-bands'
import type { PartnerAnalytics } from '@/lib/partners/analytics'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-navy">{value}</div>
    </div>
  )
}

export function AnalyticsView({ analytics }: { analytics: PartnerAnalytics }) {
  const { funnel, verdictDistribution, candidatesWithVerdict, byDiscipline } = analytics
  const { provisioned, started, evaluated, notStarted } = funnel
  const inProgress = started - evaluated

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

  // Funnel bar exclusive segments (sum to provisioned).
  const segments = [
    { label: 'Not started', count: notStarted, color: '#cbd5e1' }, // slate-300
    { label: 'In progress', count: inProgress, color: '#f59e0b' }, // amber
    { label: 'Evaluated', count: evaluated, color: '#0d9488' }, // teal
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Provisioned" value={provisioned} />
        <StatCard label="Started" value={started} />
        <StatCard label="Evaluated" value={evaluated} />
      </div>

      {/* Funnel */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Cohort funnel</h2>
        <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
          {segments.map((s) =>
            s.count > 0 ? (
              <div key={s.label} style={{ width: `${pct(s.count, provisioned)}%`, backgroundColor: s.color }} title={`${s.label}: ${s.count}`} />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600">{s.label}</span>
              <span className="font-semibold text-navy">{s.count}</span>
              <span className="text-slate-400">({pct(s.count, provisioned)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verdict distribution */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Verdict distribution <span className="font-normal normal-case text-slate-400">· best result per candidate</span>
        </h2>
        {candidatesWithVerdict === 0 ? (
          <p className="text-sm text-slate-500">No evaluations yet.</p>
        ) : (
          <div className="space-y-3">
            {verdictDistribution.map(({ band, count }) => (
              <div key={band}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{band}</span>
                  <span className="text-slate-500">
                    <span className="font-semibold text-navy">{count}</span> ({pct(count, candidatesWithVerdict)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct(count, candidatesWithVerdict)}%`, backgroundColor: verdictBarColor(band) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-discipline */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <h2 className="px-5 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">By discipline</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2 font-medium">Discipline</th>
              <th className="px-5 py-2 font-medium">Candidates</th>
              <th className="px-5 py-2 font-medium">Started</th>
              <th className="px-5 py-2 font-medium">Evaluated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byDiscipline.map((d) => (
              <tr key={d.discipline}>
                <td className="px-5 py-2.5 font-medium text-slate-900">{DISCIPLINE_NAME.get(d.discipline) ?? d.discipline}</td>
                <td className="px-5 py-2.5 text-slate-600">{d.candidates}</td>
                <td className="px-5 py-2.5 text-slate-600">{d.started}</td>
                <td className="px-5 py-2.5 text-slate-600">{d.evaluated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

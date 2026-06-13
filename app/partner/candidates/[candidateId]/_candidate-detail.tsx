import Link from 'next/link'
import { disciplines } from '@/lib/disciplines-data'
import type { PartnerCandidateDetail } from '@/lib/partners/candidateDetail'
import { partnerVerdictStyle } from '@/lib/verdict-bands'
import { TaskCriteria } from './_task-criteria'

const DISCIPLINE_NAME = new Map(disciplines.map((d) => [d.slug, d.name] as const))

type TaskScore = { taskId: number; title: string; score: number; maxScore: number; summary: string }
type CriterionScore = { taskId: number; name: string; level: string; score: number; feedback: string }

// task_scores / criteria_scores arrive typed `unknown` — parse defensively.
function parseTasks(v: unknown): TaskScore[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      taskId: Number(t.taskId ?? 0),
      title: typeof t.title === 'string' ? t.title : 'Untitled task',
      score: Number(t.score ?? 0),
      maxScore: Number(t.maxScore ?? 0),
      summary: typeof t.summary === 'string' ? t.summary : '',
    }))
    .sort((a, b) => a.taskId - b.taskId)
}
function parseCriteria(v: unknown): CriterionScore[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      taskId: Number(c.taskId ?? 0),
      name: typeof c.name === 'string' ? c.name : 'Criterion',
      level: typeof c.level === 'string' ? c.level : '',
      score: Number(c.score ?? 0),
      feedback: typeof c.feedback === 'string' ? c.feedback : '',
    }))
}

export function CandidateDetail({ detail }: { detail: PartnerCandidateDetail }) {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/partner" className="text-sm text-slate-500 hover:text-slate-800">← Back to candidates</Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">{detail.fullName ?? 'Unnamed candidate'}</h1>
            <p className="text-sm text-slate-500">{detail.email ?? '—'}</p>
          </div>
          <Link href={`/${detail.slug}`} className="shrink-0 text-sm font-medium text-teal hover:underline">Public portfolio ↗</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {detail.disciplines.map((s) => (
            <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {DISCIPLINE_NAME.get(s) ?? s}
            </span>
          ))}
        </div>
      </div>

      {detail.simulations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          This candidate hasn’t started any simulations in your provisioned disciplines yet.
        </div>
      ) : (
        detail.simulations.map((sim) => {
          const tasks = parseTasks(sim.evaluation?.taskScores)
          const criteria = parseCriteria(sim.evaluation?.criteriaScores)
          const maxTotal = tasks.reduce((sum, t) => sum + t.maxScore, 0)
          return (
            <section key={sim.simulationSlug} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-900">{sim.simulationSlug}</h2>
                  {sim.evaluation?.verdictBand && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${partnerVerdictStyle(sim.evaluation.verdictBand)}`}>
                      {sim.evaluation.verdictBand}
                      {sim.evaluation.overallScore != null && maxTotal > 0 ? ` · ${sim.evaluation.overallScore} / ${maxTotal}` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {DISCIPLINE_NAME.get(sim.discipline ?? '') ?? sim.discipline} · {sim.status ?? 'no status'}
                  {sim.submittedAt ? ` · submitted ${new Date(sim.submittedAt).toLocaleDateString('en-GB')}` : ''}
                </p>
              </div>

              {sim.evaluation?.feedbackText && (
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Overall feedback</h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{sim.evaluation.feedbackText}</p>
                </div>
              )}

              {tasks.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {tasks.map((t) => (
                    <div key={t.taskId} className="px-6 py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">Task {t.taskId}: {t.title}</h3>
                        <span className="shrink-0 text-sm font-medium text-slate-600">{t.score} / {t.maxScore}</span>
                      </div>
                      {t.summary && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{t.summary}</p>}
                      <TaskCriteria criteria={criteria.filter((c) => c.taskId === t.taskId)} />
                    </div>
                  ))}
                </div>
              )}

              {sim.responses.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate submissions</h3>
                  <div className="space-y-4">
                    {sim.responses.map((r) => (
                      <div key={r.taskNumber} className="rounded-md border border-slate-200 bg-white p-4">
                        <p className="mb-1 text-xs font-semibold text-slate-500">Task {r.taskNumber}</p>
                        {r.responseText && <p className="whitespace-pre-wrap text-sm text-slate-700">{r.responseText}</p>}
                        {r.rationaleText && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-slate-500">Rationale</p>
                            <p className="whitespace-pre-wrap text-sm text-slate-600">{r.rationaleText}</p>
                          </div>
                        )}
                        {(r.files.length > 0 || r.linkUrls.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.files.map((f, i) =>
                              f.signedUrl ? (
                                <a key={i} href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-teal hover:underline">File {i + 1} ↗</a>
                              ) : (
                                <span key={i} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400">File unavailable</span>
                              )
                            )}
                            {r.linkUrls.map((u, i) => (
                              <a key={`l${i}`} href={u} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-teal hover:underline">Link {i + 1} ↗</a>
                            ))}
                          </div>
                        )}
                        {!r.responseText && !r.rationaleText && r.files.length === 0 && r.linkUrls.length === 0 && (
                          <p className="text-sm text-slate-400">No response submitted.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

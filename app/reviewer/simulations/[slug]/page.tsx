import React from 'react'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUserRole } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { CertifyForm } from './_certify-form'

export const dynamic = 'force-dynamic'

export default async function ReviewerSimulationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'reviewer') redirect('/auth/login?next=/reviewer')

  const { slug } = await params

  // Get reviewer disciplines
  const { data: disciplineRows } = await supabaseServer
    .from('reviewer_disciplines')
    .select('discipline')
    .eq('reviewer_id', ctx.userId)

  const disciplines = (disciplineRows ?? []).map(d => d.discipline)

  // Fetch simulation
  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!sim) notFound()

  if (sim.discipline && !disciplines.includes(sim.discipline)) {
    redirect('/reviewer')
  }

  // Fetch prompts from simulation_prompts table (ordered by id, matching admin behaviour)
  const { data: promptRows } = await supabaseServer
    .from('simulation_prompts')
    .select('*')
    .eq('simulation_id', sim.id)
    .order('id', { ascending: true })

  const prompts = (promptRows ?? []).map(p => ({
    id: String(p.id),
    type: p.type as string,
    title: p.title as string,
    question: p.question as string,
    guidance: Array.isArray(p.guidance) ? (p.guidance as string[]) : [],
    minWords: Number(p.min_words ?? 0),
  }))

  // Fetch active rubric — keyed by simulation_slug, not simulation_id
  const { data: rubric } = await supabaseServer
    .from('rubrics')
    .select('id, version, system_prompt, model, max_score, is_active')
    .eq('simulation_slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  const currentStatus = (sim.cert_status ?? 'pending') as 'pending' | 'certified' | 'rejected'

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/reviewer"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft size={14} />
        Back to queue
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{sim.title ?? sim.slug}</h1>
            {sim.discipline && (
              <p className="text-sm text-slate-500 mt-1">{sim.discipline}</p>
            )}
          </div>
          <StatusBadge status={currentStatus} />
        </div>
        {sim.brief && (
          <p className="text-sm text-slate-600 mt-4 leading-relaxed">{sim.brief}</p>
        )}
      </div>

      {/* Prompts */}
      {prompts.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Prompts ({prompts.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {prompts.map((p, i) => (
              <div key={p.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-teal bg-teal/10 rounded px-2 py-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{p.title}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{p.question}</p>
                {p.guidance.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.guidance.map((g, gi) => (
                      <li key={gi} className="text-xs text-slate-500 flex items-start gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                )}
                {p.minWords > 0 && (
                  <p className="text-xs text-slate-400 mt-2">Min. {p.minWords} words</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rubric */}
      {rubric && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Rubric</h2>
            <span className="text-xs text-slate-500">
              v{rubric.version} · {rubric.model} · max {rubric.max_score}
            </span>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">System prompt</p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded-md p-4 border border-slate-100">
              {rubric.system_prompt}
            </pre>
          </div>
        </section>
      )}

      {/* Certification */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Certification decision</h2>
        </div>
        <div className="px-6 py-5">
          <CertifyForm slug={slug} currentStatus={currentStatus} currentNotes={sim.cert_notes ?? ''} />
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-50 border-amber-200 text-amber-700',
    certified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    rejected:  'bg-red-50 border-red-200 text-red-700',
  }
  const label: Record<string, string> = {
    pending: 'Pending', certified: 'Certified', rejected: 'Rejected',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${map[status] ?? map.pending}`}>
      {label[status] ?? 'Pending'}
    </span>
  )
}

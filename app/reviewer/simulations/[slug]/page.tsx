import React from 'react'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUserRole } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { CertifyForm } from './_certify-form'
import { CommentablePage } from './_commentable-page'

export const dynamic = 'force-dynamic'

// Normalize discipline to a slug for comparison ("Product Management" ↔ "product-management")
function normDisc(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[\s&]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}

async function canAccess(reviewerId: string, sim: { discipline?: string | null; industry?: string | null; slug: string }): Promise<boolean> {
  const { data: disciplineRows } = await supabaseServer
    .from('reviewer_disciplines')
    .select('discipline')
    .eq('reviewer_id', reviewerId)

  const { data: assignmentRows } = await supabaseServer
    .from('reviewer_assignments')
    .select('discipline, industry, slug')
    .eq('reviewer_id', reviewerId)

  const simDisc = normDisc(sim.discipline)

  for (const a of assignmentRows ?? []) {
    if (a.slug && a.slug === sim.slug) return true
    if (a.industry && a.industry === sim.industry) return true
    if (a.discipline && simDisc && normDisc(a.discipline) === simDisc) return true
  }

  if (simDisc && (disciplineRows ?? []).some(d => normDisc(d.discipline) === simDisc)) return true

  return false
}

export default async function ReviewerSimulationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'reviewer') redirect('/auth/login?next=/reviewer')

  const { slug } = await params

  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!sim) notFound()

  if (!await canAccess(ctx.userId, sim)) {
    redirect('/reviewer')
  }

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
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {sim.discipline && <p className="text-sm text-slate-500">{sim.discipline}</p>}
              {sim.industry && <p className="text-sm text-slate-400">{sim.industry}</p>}
              {sim.company && <p className="text-sm text-slate-400">{sim.company}</p>}
            </div>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
      </div>

      <CommentablePage
        slug={slug}
        reviewerId={ctx.userId}
        videoUrl={sim.video_url ?? null}
        videoTranscript={sim.video_transcript ?? null}
        brief={sim.brief_short ?? sim.brief_full ?? null}
        prompts={prompts}
        rubric={
          rubric
            ? {
                id: String(rubric.id),
                version: Number(rubric.version),
                system_prompt: String(rubric.system_prompt),
                model: String(rubric.model),
                max_score: Number(rubric.max_score),
              }
            : null
        }
      />

      {/* Certification */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Approval decision</h2>
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

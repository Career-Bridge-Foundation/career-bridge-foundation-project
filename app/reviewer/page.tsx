import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUserRole } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

const CERT_STYLE = {
  pending:   { label: 'Pending',    class: 'bg-amber-50 border-amber-200 text-amber-700'   },
  certified: { label: 'Certified',  class: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  rejected:  { label: 'Rejected',   class: 'bg-red-50 border-red-200 text-red-700'         },
}

export const dynamic = 'force-dynamic'

export default async function ReviewerPage() {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'reviewer') redirect('/auth/login?next=/reviewer')

  // Get reviewer's disciplines (legacy table)
  const { data: disciplineRows } = await supabaseServer
    .from('reviewer_disciplines')
    .select('discipline')
    .eq('reviewer_id', ctx.userId)
  const legacyDisciplines = new Set((disciplineRows ?? []).map(d => d.discipline))

  // Get granular assignments (discipline / industry / slug)
  const { data: assignmentRows } = await supabaseServer
    .from('reviewer_assignments')
    .select('discipline, industry, slug')
    .eq('reviewer_id', ctx.userId)
  const assignedDisciplines = new Set((assignmentRows ?? []).map(a => a.discipline).filter(Boolean))
  const assignedIndustries  = new Set((assignmentRows ?? []).map(a => a.industry).filter(Boolean))
  const assignedSlugs       = new Set((assignmentRows ?? []).map(a => a.slug).filter(Boolean))

  const hasAnyAssignment =
    legacyDisciplines.size > 0 ||
    assignedDisciplines.size > 0 ||
    assignedIndustries.size > 0 ||
    assignedSlugs.size > 0

  // Fetch all simulations
  const { data: allSims } = await supabaseServer
    .from('simulations')
    .select('*')
    .order('created_at', { ascending: false })

  // Strict filter: reviewer sees ONLY sims that match their assignments.
  // If they have no assignments at all, their queue is empty (admin must assign them first).
  const sims = hasAnyAssignment
    ? (allSims ?? []).filter(s => {
        // Discipline match (legacy or new)
        if (s.discipline && (legacyDisciplines.has(s.discipline) || assignedDisciplines.has(s.discipline))) return true
        // Industry match (covers both classified and unclassified sims)
        if (s.industry && assignedIndustries.has(s.industry)) return true
        // Direct slug assignment
        if (assignedSlugs.has(s.slug)) return true
        return false
      })
    : []

  const counts = {
    pending:   sims.filter(s => (s.cert_status ?? 'pending') === 'pending').length,
    certified: sims.filter(s => s.cert_status === 'certified').length,
    rejected:  sims.filter(s => s.cert_status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Queue</h1>
        <p className="text-sm mt-1 text-slate-600">
          {sims.length > 0
            ? `${sims.length} simulation${sims.length !== 1 ? 's' : ''} assigned to you`
            : 'No simulations assigned yet — contact your admin'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'pending',   label: 'Pending review', count: counts.pending   },
          { key: 'certified', label: 'Certified',       count: counts.certified },
          { key: 'rejected',  label: 'Rejected',        count: counts.rejected  },
        ] as const).map(({ key, label, count }) => (
          <div key={key} className="bg-white rounded-lg border border-slate-200 px-5 py-4">
            <div className="text-2xl font-bold text-slate-900">{count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Simulation list */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {sims.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500 text-sm">
            No simulations match your disciplines yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sims.map(sim => {
              const status = (sim.cert_status ?? 'pending') as keyof typeof CERT_STYLE
              const style = CERT_STYLE[status] ?? CERT_STYLE.pending
              return (
                <Link
                  key={sim.id}
                  href={`/reviewer/simulations/${sim.slug}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {sim.title ?? sim.slug}
                    </div>
                    {sim.discipline && (
                      <div className="text-xs text-slate-500 mt-0.5">{sim.discipline}</div>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${style.class} shrink-0`}>
                    {style.label}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

import React from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { TeamManager } from './_team-manager'
import type { UserRoleRecord, ReviewerDiscipline } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const ctx = await requireAdmin()

  const { data: roles } = await supabaseServer
    .from('user_roles')
    .select('*')
    .neq('role', 'candidate')
    .order('created_at', { ascending: false })

  const reviewerIds = (roles ?? [])
    .filter(r => r.role === 'reviewer')
    .map(r => r.user_id)

  let disciplines: ReviewerDiscipline[] = []
  if (reviewerIds.length > 0) {
    const { data } = await supabaseServer
      .from('reviewer_disciplines')
      .select('reviewer_id, discipline')
      .in('reviewer_id', reviewerIds)
    disciplines = data ?? []
  }

  // Fetch granular reviewer_assignments for all reviewers
  type Assignment = { id: string; reviewer_id: string; discipline: string | null; industry: string | null; slug: string | null }
  let assignmentMap: Record<string, Assignment[]> = {}
  if (reviewerIds.length > 0) {
    const { data: assignments } = await supabaseServer
      .from('reviewer_assignments')
      .select('id, reviewer_id, discipline, industry, slug')
      .in('reviewer_id', reviewerIds)
    for (const a of assignments ?? []) {
      if (!assignmentMap[a.reviewer_id]) assignmentMap[a.reviewer_id] = []
      assignmentMap[a.reviewer_id].push(a as Assignment)
    }
  }

  // Fetch distinct industries from simulations for the assignment UI
  const { data: industryRows } = await supabaseServer
    .from('simulations')
    .select('industry')
    .not('industry', 'is', null)
  const industries = [...new Set((industryRows ?? []).map(r => r.industry).filter(Boolean))] as string[]

  // Fetch simulation options (slug + title) for slug-based assignment
  const { data: simRows } = await supabaseServer
    .from('simulations')
    .select('slug, title')
    .order('title', { ascending: true })
  const simOptions = (simRows ?? []).map(r => ({ slug: r.slug as string, title: r.title as string | null }))

  const members: (UserRoleRecord & { disciplines: string[]; assignments: Assignment[] })[] = (roles ?? []).map(r => {
    const disc = disciplines
      .filter(d => d.reviewer_id === r.user_id)
      .map(d => d.discipline)
    return {
      ...(r as UserRoleRecord),
      disciplines: disc,
      assignments: assignmentMap[r.user_id] ?? [],
    }
  })

  const canManage = ctx.permissions.canManageUsers || ctx.role === 'super_admin'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
        <p className="text-sm mt-1 text-slate-600">
          Manage admins, reviewers, and their permissions.
        </p>
      </div>
      <TeamManager
        members={members}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
        canManage={canManage}
        industries={industries}
        simOptions={simOptions}
      />
    </div>
  )
}

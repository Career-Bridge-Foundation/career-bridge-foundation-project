import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const ctx = await requireAdmin()

    if (!ctx.permissions.canManageUsers && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: roles, error } = await supabaseServer
      .from('user_roles')
      .select('*')
      .neq('role', 'candidate')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich reviewers with their disciplines and granular assignments
    const reviewerIds = (roles ?? [])
      .filter(r => r.role === 'reviewer')
      .map(r => r.user_id)

    let disciplineMap: Record<string, string[]> = {}
    let assignmentMap: Record<string, unknown[]> = {}
    if (reviewerIds.length > 0) {
      const { data: disciplines } = await supabaseServer
        .from('reviewer_disciplines')
        .select('reviewer_id, discipline')
        .in('reviewer_id', reviewerIds)

      for (const d of disciplines ?? []) {
        if (!disciplineMap[d.reviewer_id]) disciplineMap[d.reviewer_id] = []
        disciplineMap[d.reviewer_id].push(d.discipline)
      }

      const { data: assignments } = await supabaseServer
        .from('reviewer_assignments')
        .select('id, reviewer_id, discipline, industry, slug')
        .in('reviewer_id', reviewerIds)

      for (const a of assignments ?? []) {
        if (!assignmentMap[a.reviewer_id]) assignmentMap[a.reviewer_id] = []
        assignmentMap[a.reviewer_id].push(a)
      }
    }

    const members = (roles ?? []).map(r => ({
      ...r,
      disciplines: disciplineMap[r.user_id] ?? [],
      assignments: assignmentMap[r.user_id] ?? [],
    }))

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()

    if (!ctx.permissions.canManageUsers && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role, permissions, disciplines } = body as {
      email: string
      role: string
      permissions?: Record<string, boolean>
      disciplines?: string[]
    }

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
    }

    if (!['admin', 'reviewer', 'content_developer'].includes(role)) {
      return NextResponse.json({ error: 'role must be admin, reviewer, or content_developer' }, { status: 400 })
    }

    // Resolve user by email via admin API
    const { data: { users }, error: listErr } = await supabaseServer.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const targetUser = users.find(u => u.email === email)
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
    }

    const defaultPerms = role === 'admin'
      ? { canManageSimulations: true, canManageUsers: false, canViewAnalytics: true, canExportData: false }
      : {}

    const { error: upsertErr } = await supabaseServer
      .from('user_roles')
      .upsert({
        user_id: targetUser.id,
        email: targetUser.email,
        role,
        permissions: permissions ?? defaultPerms,
        granted_by: ctx.userId,
      }, { onConflict: 'user_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    // Set disciplines for reviewers
    if (role === 'reviewer' && Array.isArray(disciplines)) {
      await supabaseServer
        .from('reviewer_disciplines')
        .delete()
        .eq('reviewer_id', targetUser.id)

      if (disciplines.length > 0) {
        await supabaseServer
          .from('reviewer_disciplines')
          .insert(disciplines.map(d => ({ reviewer_id: targetUser.id, discipline: d })))
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

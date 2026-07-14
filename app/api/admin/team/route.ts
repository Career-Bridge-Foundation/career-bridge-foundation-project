import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { generateInviteToken, hashInviteToken } from '@/lib/partners/inviteToken'
import { sendInvitationEmail } from '@/lib/email/invitations'

const INVITE_TTL_DAYS = 7 // mirrors app/api/partner/invites/route.ts
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  content_developer: 'Content Developer',
}

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
    const { data: { users }, error: listErr } =
      await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const targetUser = users.find(u => u.email === email)
    if (!targetUser) {
      // No account yet — invite instead of failing. Reuses the partner_invites
      // pipeline with partner_id: null (staff invite, not org-scoped) — see
      // schema-reference/05.11-staff-invites.sql for the constraint changes
      // this depends on, and app/api/partner/invites/accept/route.ts for the
      // acceptance side (skips the org-hijack guard when partner_id is null).
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (!appUrl) {
        return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 })
      }

      const token = generateInviteToken()
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000)

      const { error: insErr } = await supabaseServer.from('partner_invites').insert({
        partner_id: null,
        invited_email: email,
        invited_by: ctx.userId,
        role,
        token_hash: hashInviteToken(token),
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        pending_disciplines: role === 'reviewer' && Array.isArray(disciplines) ? disciplines : null,
      })
      if (insErr) {
        console.error('[admin/team] staff invite insert failed', insErr.message)
        return NextResponse.json({ error: 'could not create invite' }, { status: 500 })
      }

      try {
        await sendInvitationEmail({
          to: email,
          inviteUrl: `${appUrl}/accept-invite?token=${token}`,
          partnerId: null,
          expiresInDays: INVITE_TTL_DAYS,
          roleLabel: ROLE_LABELS[role],
        })
      } catch (e) {
        console.error('[admin/team] invite email send failed (invite persisted)', e)
      }

      return NextResponse.json({ success: true, invited: true, email })
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

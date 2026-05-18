import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const ctx = await requireAdmin()

    if (!ctx.permissions.canManageUsers && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await params

    // Guard: cannot modify super_admin accounts
    const { data: existing } = await supabaseServer
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify super_admin accounts' }, { status: 403 })
    }

    const body = await request.json()
    const { role, permissions, disciplines, addAssignment } = body as {
      role?: string
      permissions?: Record<string, boolean>
      disciplines?: string[]
      addAssignment?: { discipline?: string; industry?: string; slug?: string }
    }

    const updates: Record<string, unknown> = {}
    if (role) updates.role = role
    if (permissions) updates.permissions = permissions

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseServer
        .from('user_roles')
        .update(updates)
        .eq('user_id', userId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update disciplines if provided
    if (Array.isArray(disciplines)) {
      await supabaseServer
        .from('reviewer_disciplines')
        .delete()
        .eq('reviewer_id', userId)

      if (disciplines.length > 0) {
        await supabaseServer
          .from('reviewer_disciplines')
          .insert(disciplines.map(d => ({ reviewer_id: userId, discipline: d })))
      }
    }

    // Add a single granular assignment
    if (addAssignment) {
      const { discipline, industry, slug } = addAssignment
      if (!discipline && !industry && !slug) {
        return NextResponse.json({ error: 'At least one of discipline, industry, or slug is required' }, { status: 400 })
      }
      const { error } = await supabaseServer
        .from('reviewer_assignments')
        .insert({ reviewer_id: userId, discipline: discipline ?? null, industry: industry ?? null, slug: slug ?? null })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const ctx = await requireAdmin()

    if (!ctx.permissions.canManageUsers && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await params

    // Guard: cannot remove super_admin accounts
    const { data: existing } = await supabaseServer
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing?.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove super_admin accounts' }, { status: 403 })
    }

    await supabaseServer
      .from('reviewer_disciplines')
      .delete()
      .eq('reviewer_id', userId)

    await supabaseServer
      .from('reviewer_assignments')
      .delete()
      .eq('reviewer_id', userId)

    const { error } = await supabaseServer
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

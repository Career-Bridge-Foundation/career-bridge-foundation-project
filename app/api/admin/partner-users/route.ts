import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Auth: super_admin only — partner role grants access to a partner's
  // entire candidate dataset, so this is a high-privilege provisioning op.
  let ctx
  try {
    ctx = await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }
    const { email, partner_id } = body as { email?: string; partner_id?: string }
    if (!email || !partner_id) {
      return NextResponse.json(
        { error: 'email and partner_id are required' },
        { status: 400 }
      )
    }

    // Verify the partner org exists before linking anyone to it.
    const { data: partner, error: partnerErr } = await supabaseServer
      .from('partners')
      .select('id, name')
      .eq('id', partner_id)
      .maybeSingle()
    if (partnerErr) {
      return NextResponse.json({ error: partnerErr.message }, { status: 500 })
    }
    if (!partner) {
      return NextResponse.json({ error: 'No partner found with that id' }, { status: 404 })
    }

    // Resolve the user by email — they must already have an account.
    // perPage bumped high to avoid the default-50 pagination miss.
    const { data: { users }, error: listErr } =
      await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }
    const targetUser = users.find((u) => u.email === email)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'No user found with that email — they must sign up first' },
        { status: 404 }
      )
    }

    // Elevate to partner role linked to the org. Flat role, no granular
    // permissions for MVP (the permissions column stays an empty object).
    const { error: upsertErr } = await supabaseServer
      .from('user_roles')
      .upsert(
        {
          user_id: targetUser.id,
          email: targetUser.email,
          role: 'partner',
          permissions: {},
          partner_id,
          granted_by: ctx.userId,
        },
        { onConflict: 'user_id' }
      )
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email: targetUser.email,
      partner: partner.name,
    })
  } catch (err) {
    console.error('[admin/partner-users] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

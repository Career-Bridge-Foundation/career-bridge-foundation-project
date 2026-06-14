import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/partner/mentor-users — a partner-admin elevates an existing user to
 * a mentor WITHIN THEIR OWN org. Role only; discipline grants + candidate
 * assignments are separate actions.
 *
 * Scoping (structural): partner_id is FORCED from ctx.partnerId — never read
 * from the body. The body supplies only `email`.
 */
export async function POST(request: NextRequest) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  const { email } = body as { email?: string } // only email; partner_id is NEVER read from the body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  // Resolve the user — they must already have an account.
  const { data: { users }, error: listErr } = await supabaseServer.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
  const target = users.find((u) => u.email === email)
  if (!target) {
    return NextResponse.json(
      { error: 'No user found with that email — they must sign up first' },
      { status: 404 }
    )
  }

  // HIJACK GUARD: this endpoint is partner-scoped (lower privilege than the
  // super-admin partner-users endpoint), so it must not overwrite a user who
  // already belongs to another org or holds a non-mentor role. Only an
  // unaffiliated user (no role / candidate) or an existing mentor OF THIS
  // partner may be elevated here.
  const { data: existing, error: exErr } = await supabaseServer
    .from('user_roles')
    .select('role, partner_id')
    .eq('user_id', target.id)
    .maybeSingle()
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
  if (
    existing &&
    ((existing.partner_id && existing.partner_id !== ctx.partnerId) ||
      !['candidate', 'mentor'].includes(existing.role as string))
  ) {
    return NextResponse.json(
      { error: 'This user already has a role in another organisation' },
      { status: 409 }
    )
  }

  // Elevate. partner_id FORCED from ctx; re-fetch the written row to prove scoping.
  const { data: written, error: upsertErr } = await supabaseServer
    .from('user_roles')
    .upsert(
      {
        user_id: target.id,
        email: target.email,
        role: 'mentor',
        permissions: {},
        partner_id: ctx.partnerId, // FORCED from ctx, never the body
        granted_by: ctx.userId,
      },
      { onConflict: 'user_id' }
    )
    .select('role, partner_id')
    .maybeSingle()
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    email: target.email,
    role: written?.role ?? null,
    partner_id: written?.partner_id ?? null,
  })
}

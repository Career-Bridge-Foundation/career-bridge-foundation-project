import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { elevateUser } from '@/lib/auth/elevateUser'
import { isCrossOrgHijack } from '@/lib/auth/assertNoCrossOrgHijack'
import { supabaseServer } from '@/lib/supabase/server'
import { sendMentorAddedEmail } from '@/lib/email/mentor-notifications'
import { partnerAppUrl } from '@/lib/partners/branding'

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
    isCrossOrgHijack({
      existing: existing as { role: string; partner_id: string | null } | null,
      partnerId: ctx.partnerId!,
      allowedRoles: ['candidate', 'mentor'],
    })
  ) {
    return NextResponse.json(
      { error: 'This user already has a role in another organisation' },
      { status: 409 }
    )
  }

  // Elevate. partner_id FORCED from ctx; re-fetch the written row to prove scoping.
  const { data: written, error: upsertErr } = await elevateUser({
    targetUserId: target.id,
    email: target.email,
    role: 'mentor',
    partnerId: ctx.partnerId, // FORCED from ctx, never the body
    grantedBy: ctx.userId,
  })
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // Best-effort mentor-added notification — a send failure must NEVER fail the
  // 200, the elevation already succeeded. Mirrors the invites POST pattern
  // (awaited try/catch, not after()). appUrl read the same way as invites/route.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && target.email) {
    try {
      const { data: partnerRow } = await supabaseServer
        .from('partners')
        .select('subdomain')
        .eq('id', ctx.partnerId)
        .maybeSingle()
      const baseUrl = partnerAppUrl(partnerRow?.subdomain as string | null | undefined, appUrl)

      await sendMentorAddedEmail({
        to: target.email,
        partnerId: ctx.partnerId,
        consoleUrl: `${baseUrl}/mentor`,
      })
    } catch (e) {
      console.error('[mentor-added email]', e)
    }
  }

  return NextResponse.json({
    success: true,
    email: target.email,
    role: written?.role ?? null,
    partner_id: written?.partner_id ?? null,
  })
}

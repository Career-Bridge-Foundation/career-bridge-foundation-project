import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/partners/inviteToken'
import { isCrossOrgHijack } from '@/lib/auth/assertNoCrossOrgHijack'
import { elevateUser } from '@/lib/auth/elevateUser'

export const runtime = 'nodejs'

/**
 * POST /api/partner/invites/accept — the logged-in invitee accepts a partner
 * sub-admin invite and is elevated to a flat 'partner' role linked to the
 * inviter's org.
 *
 * SECURITY PATH — identity and non-capture are proven BEFORE any elevation:
 *   1. authenticated session (getUser)                → 401
 *   2. invite resolved by token hash                  → 404
 *   3. state guards: already-accepted 409 / expired 410
 *   4. STRICT EMAIL BINDING (user.email == invited_email) → 403   ← before elevate
 *   5. cross-org hijack guard (allowedRoles ['candidate'])  → 409 ← before elevate
 *   6. elevateUser(role='partner', partner_id from the invite)
 *   7. mark accepted atomically (.eq status 'pending')
 *
 * Elevate BEFORE mark = retryable: if elevate fails the invite stays pending.
 * Auth uses the cookie/SSR client; all table work uses the service-role client
 * (mirrors /api/redeem). The token is never logged.
 */
export async function POST(request: Request) {
  try {
    // 1. AUTH (cookie client)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
    }

    // 2. PARSE
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }
    const token = (json as { token?: unknown })?.token
    if (typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    // 3. LOOKUP (service-role) by hash
    const { data: invite } = await supabaseServer
      .from('partner_invites')
      .select('id, partner_id, invited_email, status, expires_at, invited_by')
      .eq('token_hash', hashInviteToken(token))
      .maybeSingle()
    if (!invite) {
      return NextResponse.json({ error: 'invite not found' }, { status: 404 })
    }

    // 4. STATE GUARDS (order mirrors /redeem)
    if (invite.status === 'accepted') {
      return NextResponse.json({ error: 'invite already accepted' }, { status: 409 })
    }
    if (new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'invite expired' }, { status: 410 })
    }

    // 5. STRICT EMAIL BINDING — before elevate.
    if (user.email.toLowerCase().trim() !== invite.invited_email.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'this invite is not for your account' },
        { status: 403 }
      )
    }

    // 6. CROSS-ORG HIJACK GUARD — before elevate. A partner invite may only
    //    elevate an unaffiliated user (no role) or a plain candidate; anyone
    //    already holding a role in another org is rejected.
    const { data: existing, error: exErr } = await supabaseServer
      .from('user_roles')
      .select('role, partner_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
    if (
      isCrossOrgHijack({
        existing: existing as { role: string; partner_id: string | null } | null,
        partnerId: invite.partner_id,
        allowedRoles: ['candidate'],
      })
    ) {
      return NextResponse.json(
        { error: 'This account already has a role in another organisation' },
        { status: 409 }
      )
    }

    // 7. ELEVATE (role='partner', partner_id FORCED from the invite row).
    const { error: elevErr } = await elevateUser({
      targetUserId: user.id,
      email: user.email,
      role: 'partner',
      partnerId: invite.partner_id,
      grantedBy: invite.invited_by ?? user.id,
    })
    if (elevErr) {
      // Do NOT mark accepted — the invite stays pending and is retryable.
      console.error('[invites/accept] elevate failed', elevErr.message)
      return NextResponse.json({ error: 'could not complete acceptance' }, { status: 500 })
    }

    // 8. MARK ACCEPTED (only after elevate). The .eq('status','pending') makes
    //    the mark atomic against a concurrent double-accept.
    const { error: markErr } = await supabaseServer
      .from('partner_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq('id', invite.id)
      .eq('status', 'pending')
    if (markErr) {
      // Elevation already succeeded — the mark is bookkeeping. Log, don't fail.
      console.error('[invites/accept] failed to mark accepted', markErr.message)
    }

    return NextResponse.json({ success: true, partner_id: invite.partner_id })
  } catch (err) {
    console.error('[invites/accept] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

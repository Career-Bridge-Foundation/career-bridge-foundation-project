import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/partners/inviteToken'
import { isCrossOrgHijack } from '@/lib/auth/assertNoCrossOrgHijack'
import { elevateUser } from '@/lib/auth/elevateUser'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/partner/invites/accept — accept a partner/mentor invite.
 *
 * Two paths:
 *   - Authenticated: the logged-in invitee accepts, elevated to the invite's
 *     role. Identity and non-capture are proven BEFORE any elevation (strict
 *     email binding, cross-org hijack guard) — unchanged from before.
 *   - No session: only when `invited_email` has NO existing Supabase account
 *     — the account is created and signed in server-side (possession of the
 *     invite token substitutes for a password), then elevated the same way.
 *     An email that already has an account still gets 401 — auto-login must
 *     never apply to a pre-existing account, or anyone could hijack one just
 *     by sending it an "invite".
 *
 * SECURITY PATH:
 *   1. rate limit (per token hash)                         → 429
 *   2. invite resolved by token hash                       → 404
 *   3. state guards: already-accepted 409 / expired 410
 *   4a. [authenticated] STRICT EMAIL BINDING                → 403
 *   4b. [authenticated] cross-org hijack guard              → 409
 *   4c. [no session] admin.createUser — 'email_exists'      → 401
 *   4d. [no session] generateLink + verifyOtp establishes a real session
 *   5. elevateUser(role, partner_id from the invite)
 *   6. mark accepted atomically (.eq status 'pending')
 *
 * The no-session existence check is `admin.createUser`'s own unique-constraint
 * failure, not a `listUsers` scan — that's DB-authoritative and can't silently
 * miss an existing account past a page size, which here would mean skipping
 * the hijack guard against a real account.
 *
 * Elevate BEFORE mark = retryable: if elevate fails the invite stays pending.
 * Table work uses the service-role client (mirrors /api/redeem). The token,
 * hashed_token, and action_link are never logged.
 */
export async function POST(request: Request) {
  try {
    // 1. PARSE
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
    const tokenHash = hashInviteToken(token)

    // 2. RATE LIMIT — the no-session path can mint real accounts + sessions.
    const rateLimit = checkRateLimit({
      key: `invite:accept:${tokenHash}`,
      limit: 10,
      windowMs: 60 * 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'too many attempts, try again later' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      )
    }

    // 3. LOOKUP (service-role) by hash
    const { data: invite } = await supabaseServer
      .from('partner_invites')
      .select('id, partner_id, invited_email, status, expires_at, invited_by, role')
      .eq('token_hash', tokenHash)
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

    // 5. SESSION BRANCH
    const supabase = await createClient()
    const { data: { user: sessionUser } } = await supabase.auth.getUser()

    let targetUserId: string
    let targetEmail: string
    let provisioned = false

    if (sessionUser?.email) {
      // 5a. STRICT EMAIL BINDING — before elevate.
      if (sessionUser.email.toLowerCase().trim() !== invite.invited_email.toLowerCase().trim()) {
        return NextResponse.json(
          { error: 'this invite is not for your account' },
          { status: 403 }
        )
      }

      // 5b. CROSS-ORG HIJACK GUARD — before elevate. A partner invite may only
      //     elevate an unaffiliated user (no role) or a plain candidate; anyone
      //     already holding a role in another org is rejected.
      const { data: existing, error: exErr } = await supabaseServer
        .from('user_roles')
        .select('role, partner_id')
        .eq('user_id', sessionUser.id)
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

      targetUserId = sessionUser.id
      targetEmail = sessionUser.email
    } else {
      // No session — only proceed if invited_email has NO existing account.
      const { data: created, error: createErr } = await supabaseServer.auth.admin.createUser({
        email: invite.invited_email,
        email_confirm: true,
      })
      if (createErr || !created.user) {
        if (createErr?.code === 'email_exists') {
          return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
        }
        console.error('[invites/accept] createUser failed', createErr?.message)
        return NextResponse.json({ error: 'could not create account' }, { status: 500 })
      }

      const { data: link, error: linkErr } = await supabaseServer.auth.admin.generateLink({
        type: 'magiclink',
        email: invite.invited_email,
      })
      if (linkErr) {
        console.error('[invites/accept] generateLink failed', linkErr.message)
        return NextResponse.json({ error: 'could not sign in' }, { status: 500 })
      }

      // Verified via the COOKIE-BOUND client so the resulting session is
      // written into this response's cookies (same mechanism auth/callback
      // already uses for OTP/OAuth) — the browser ends up authenticated.
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: 'magiclink',
      })
      if (verifyErr) {
        console.error('[invites/accept] verifyOtp failed', verifyErr.message)
        return NextResponse.json({ error: 'could not sign in' }, { status: 500 })
      }

      targetUserId = created.user.id
      targetEmail = invite.invited_email
      provisioned = true
    }

    // 6. ELEVATE (role from the invite, partner_id FORCED from the invite row).
    const { error: elevErr } = await elevateUser({
      targetUserId,
      email: targetEmail,
      role: invite.role,
      partnerId: invite.partner_id,
      grantedBy: invite.invited_by ?? targetUserId,
    })
    if (elevErr) {
      // Do NOT mark accepted — the invite stays pending and is retryable.
      console.error('[invites/accept] elevate failed', elevErr.message)
      return NextResponse.json({ error: 'could not complete acceptance' }, { status: 500 })
    }

    // 7. MARK ACCEPTED (only after elevate). The .eq('status','pending') makes
    //    the mark atomic against a concurrent double-accept.
    const { error: markErr } = await supabaseServer
      .from('partner_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: targetUserId,
      })
      .eq('id', invite.id)
      .eq('status', 'pending')
    if (markErr) {
      // Elevation already succeeded — the mark is bookkeeping. Log, don't fail.
      console.error('[invites/accept] failed to mark accepted', markErr.message)
    }

    return NextResponse.json({
      success: true,
      partner_id: invite.partner_id,
      role: invite.role,
      provisioned,
    })
  } catch (err) {
    console.error('[invites/accept] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

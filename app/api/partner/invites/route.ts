import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { generateInviteToken, hashInviteToken } from '@/lib/partners/inviteToken'
import { getPartnerInvites } from '@/lib/partners/inviteRoster'
import { sendInvitationEmail } from '@/lib/email/invitations'

export const runtime = 'nodejs'

/**
 * GET /api/partner/invites — this partner's invites (pending/accepted +
 * derived expired), scoped to ctx.partnerId. Wraps the same getPartnerInvites
 * the Team page reads server-side, for client refresh.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const invites = await getPartnerInvites(ctx.partnerId!)
    return NextResponse.json({ invites })
  } catch (err) {
    console.error('[partner/invites GET] failed', err)
    return NextResponse.json({ error: 'could not load invites' }, { status: 500 })
  }
}

const INVITE_TTL_DAYS = 7
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/partner/invites — a partner-admin invites a peer (another flat
 * partner-admin) to THEIR OWN org by email.
 *
 * partner_id is FORCED from ctx; the body supplies only `email`. An opaque
 * token is generated, its hash persisted (fail-closed) BEFORE the email is
 * sent, so we never email a link for a row that didn't store. The email send
 * is best-effort: the invite row is the source of truth and can be re-sent.
 *
 * Note: duplicate pending invites to the same email are allowed for MVP (each
 * is independently acceptable until used/expired) — dedup is a later refinement.
 */
export async function POST(request: NextRequest) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    const { email } = body as { email?: string }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'a valid email is required' }, { status: 400 })
    }
    const invitedEmail = email.toLowerCase().trim()

    // Generate opaque token; persist its hash FAIL-CLOSED before emailing.
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000)

    const { error: insErr } = await supabaseServer.from('partner_invites').insert({
      partner_id: ctx.partnerId, // FORCED from ctx, never the body
      invited_email: invitedEmail,
      invited_by: ctx.userId,
      token_hash: hashInviteToken(token),
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    if (insErr) {
      console.error('[partner/invites POST] insert failed', insErr.message)
      return NextResponse.json({ error: 'could not create invite' }, { status: 500 })
    }

    // Partner name for the email display/sender.
    const { data: partner } = await supabaseServer
      .from('partners')
      .select('name')
      .eq('id', ctx.partnerId)
      .maybeSingle()

    // Best-effort email — a send failure leaves a valid pending invite.
    try {
      await sendInvitationEmail({
        to: invitedEmail,
        inviteUrl: `${appUrl}/accept-invite?token=${token}`,
        partnerId: ctx.partnerId,
        partnerName: partner?.name ?? undefined,
        expiresInDays: INVITE_TTL_DAYS,
      })
    } catch (e) {
      console.error('[partner/invites POST] email send failed (invite persisted)', e)
    }

    return NextResponse.json({
      success: true,
      email: invitedEmail,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('[partner/invites POST] unexpected', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

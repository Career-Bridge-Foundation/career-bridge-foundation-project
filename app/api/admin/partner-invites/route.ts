import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { generateInviteToken, hashInviteToken } from '@/lib/partners/inviteToken'
import { sendInvitationEmail } from '@/lib/email/invitations'
import { slugify } from '@/lib/slugify'
import { partnerAppUrl } from '@/lib/partners/branding'

export const runtime = 'nodejs'

const INVITE_TTL_DAYS = 7 // mirrors app/api/partner/invites/route.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/admin/partner-invites — a super admin bootstraps a brand-new
 * partner organisation and invites its first admin, in one step.
 *
 * Two-table write, not atomic (per this repo's convention for multi-table
 * writes — see CLAUDE.md "Database-touching code"):
 *   1. insert `partners`       — nothing to link an invite to without this id
 *   2. insert `partner_invites` — if this fails, the org row is left behind;
 *      the response says so explicitly (partnerId/partnerName/slug) so the
 *      caller knows the org already exists and only the invite needs retrying
 *   3. best-effort email send  — failure is logged, not fatal; the invite
 *      row is the source of truth (mirrors app/api/partner/invites/route.ts)
 */
export async function POST(request: NextRequest) {
  let ctx
  try {
    ctx = await requireSuperAdmin()
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

    const { orgName, adminEmail } = body as { orgName?: string; adminEmail?: string }
    const trimmedName = orgName?.trim().slice(0, 200)
    if (!trimmedName) {
      return NextResponse.json({ error: 'organisation name is required' }, { status: 400 })
    }
    if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
      return NextResponse.json({ error: 'a valid admin email is required' }, { status: 400 })
    }
    const invitedEmail = adminEmail.toLowerCase().trim()

    // 1. Create the org. Retry once with a random suffix on a slug collision —
    // a second collision in a row is not worth more code for how rarely it'll happen.
    const baseSlug = slugify(trimmedName)
    let partner: { id: string; name: string; slug: string; subdomain: string | null } | null = null
    for (const slug of [baseSlug, `${baseSlug}-${randomBytes(2).toString('hex')}`]) {
      const { data, error } = await supabaseServer
        .from('partners')
        .insert({
          name: trimmedName,
          slug,
          contact_email: invitedEmail,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: ctx.userId,
          is_first_party: false,
        })
        .select('id, name, slug, subdomain')
        .single()

      if (!error) {
        partner = data
        break
      }
      if (error.code !== '23505') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    if (!partner) {
      return NextResponse.json({ error: 'could not generate a unique organisation slug' }, { status: 500 })
    }

    // 2. Create the invite, scoped to the new org.
    const token = generateInviteToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000)

    const { error: inviteErr } = await supabaseServer.from('partner_invites').insert({
      partner_id: partner.id,
      invited_email: invitedEmail,
      invited_by: ctx.userId,
      role: 'partner',
      token_hash: hashInviteToken(token),
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    if (inviteErr) {
      console.error('[admin/partner-invites] invite insert failed', inviteErr.message)
      return NextResponse.json(
        {
          error: 'organisation was created but the invite could not be sent — retry the invite for this organisation',
          partnerId: partner.id,
          partnerName: partner.name,
          slug: partner.slug,
        },
        { status: 500 }
      )
    }

    // 3. Best-effort email — a send failure leaves a valid pending invite.
    const baseUrl = partnerAppUrl(partner.subdomain, appUrl)
    try {
      await sendInvitationEmail({
        to: invitedEmail,
        inviteUrl: `${baseUrl}/accept-invite?token=${token}`,
        partnerId: partner.id,
        partnerName: partner.name,
        expiresInDays: INVITE_TTL_DAYS,
      })
    } catch (e) {
      console.error('[admin/partner-invites] email send failed (invite persisted)', e)
    }

    return NextResponse.json({
      success: true,
      partnerId: partner.id,
      partnerName: partner.name,
      slug: partner.slug,
      invitedEmail,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('[admin/partner-invites] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

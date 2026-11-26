/**
 * POST /api/account/support: in-app support request → Zoho Desk ticket
 * (Product Development department, Source = "Career Bridge").
 *
 * Identity (email, name, user ID) comes ONLY from the server-side session,
 * never from the request body. Zoho credentials are read only here on the
 * server (lib/support/*, all `server-only`).
 *
 * Rate limit: 5 attempts per user per rolling hour, enforced via the
 * support_ticket_requests table (migration 20261125_001), because in-memory
 * counters don't hold up across serverless instances.
 *
 * Non-atomic writes: the rate-limit row is inserted before the Zoho call and
 * updated after. If the update fails after Zoho succeeded, the ticket still
 * exists and the user still sees their number; the row just stays 'pending'
 * (it still counts toward the limit, which is the safe direction).
 *
 * No confirmation email is sent from here: Zoho already emails the contact.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  DEFAULT_PRIORITY,
  sanitizeContextPath,
} from '@/lib/support/ticket-options'
import { createZohoTicket, escapeHtml } from '@/lib/support/zoho-tickets'

export const dynamic = 'force-dynamic'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

const GENERIC_ERROR = 'We couldn’t submit your request right now, please try again in a few minutes.'

const BodySchema = z.object({
  subject: z.string().trim().min(SUBJECT_MIN).max(SUBJECT_MAX),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default(DEFAULT_PRIORITY),
  description: z.string().trim().min(DESCRIPTION_MIN).max(DESCRIPTION_MAX),
  // Optional "where were you" path; sanitised separately, never trusted as-is.
  context: z.unknown().optional(),
})

export async function POST(req: Request) {
  // ── 1. Session ────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email) {
    // Zoho needs an email for the contact; every real account has one.
    console.error('[support] user has no email on session', { userId: user.id })
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }

  // ── 2. Validate input (allowlists + lengths, server-side) ──────────────
  const raw = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the form: some fields are missing or too long.' },
      { status: 400 },
    )
  }
  const { subject, category, priority, description } = parsed.data
  const contextPath = sanitizeContextPath(parsed.data.context)

  // ── 3. Rate limit (insert-then-count, so concurrent requests can't both slip under) ─
  const { data: attempt, error: insertError } = await supabaseServer
    .from('support_ticket_requests')
    .insert({ user_id: user.id, category, priority, status: 'pending' })
    .select('id')
    .single()
  if (insertError || !attempt) {
    console.error('[support] could not record attempt', insertError?.message)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabaseServer
    .from('support_ticket_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if (countError) {
    console.error('[support] rate-limit count failed', countError.message)
    await supabaseServer.from('support_ticket_requests').delete().eq('id', attempt.id)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
  if ((count ?? 0) > RATE_LIMIT) {
    // Over the limit: this attempt never reached Zoho, so don't let it count.
    await supabaseServer.from('support_ticket_requests').delete().eq('id', attempt.id)
    return NextResponse.json(
      {
        error:
          'You’ve sent several requests in the last hour. Please wait a little while before sending another; we’ve got the ones you already sent.',
      },
      { status: 429 },
    )
  }

  // ── 4. Identity from the account, not the form ──────────────────────────
  const [{ data: profile }, role] = await Promise.all([
    supabaseServer.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    resolveRole(user.id, user.app_metadata),
  ])
  const name =
    (profile?.full_name as string | null | undefined)?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    ''
  const displayName = name || user.email

  // Zoho reuses existing contacts by email and silently ignores the name we
  // send, so the real identity goes at the top of the description.
  const header = [
    `<b>Submitted by:</b> ${escapeHtml(displayName)} (${escapeHtml(user.email)})`,
    `<b>Career Bridge user ID:</b> ${escapeHtml(user.id)}`,
    `<b>Account type:</b> ${escapeHtml(role)}`,
    `<b>Platform:</b> Career Bridge (in-app support page)`,
    contextPath ? `<b>Page / context:</b> ${escapeHtml(contextPath)}` : null,
  ]
    .filter(Boolean)
    .join('<br>')
  const descriptionHtml = `${header}<br><br>${escapeHtml(description)}`

  // ── 5. Create the Zoho ticket ───────────────────────────────────────────
  try {
    const ticket = await createZohoTicket({
      subject,
      description: descriptionHtml,
      category,
      priority,
      email: user.email,
      name: name || user.email,
    })

    const { error: updateError } = await supabaseServer
      .from('support_ticket_requests')
      .update({
        status: 'created',
        zoho_ticket_id: ticket.id,
        zoho_ticket_number: ticket.ticketNumber,
      })
      .eq('id', attempt.id)
    if (updateError) {
      console.error('[support] ticket created but status update failed', {
        attemptId: attempt.id,
        ticketNumber: ticket.ticketNumber,
        error: updateError.message,
      })
    }

    return NextResponse.json({ ticketNumber: ticket.ticketNumber })
  } catch (err) {
    // Server-side log only; Zoho's error text never goes to the browser.
    console.error('[support] Zoho ticket creation failed', {
      attemptId: attempt.id,
      error: err instanceof Error ? err.message : String(err),
    })
    await supabaseServer
      .from('support_ticket_requests')
      .update({ status: 'failed' })
      .eq('id', attempt.id)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 })
  }
}

async function resolveRole(userId: string, appMetadata: unknown): Promise<string> {
  const fromMeta = (appMetadata as { user_role?: string } | null)?.user_role
  if (fromMeta) return fromMeta
  const { data } = await supabaseServer
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.role as string | undefined) ?? 'candidate'
}

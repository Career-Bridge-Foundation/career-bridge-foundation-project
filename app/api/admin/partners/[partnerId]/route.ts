import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { isValidSubdomainFormat, RESERVED_SUBDOMAINS } from '@/lib/partners/branding'

export const runtime = 'nodejs'

// Basic hostname shape — not a full RFC 1035 validator, just enough to catch
// stray input before it's stored as an email-sending domain. Actual
// deliverability (SPF/DKIM/DMARC) is verified by hand in Resend regardless.
const DOMAIN_FORMAT = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

/**
 * PATCH /api/admin/partners/[partnerId] — super-admin-only partner-infra
 * fields: subdomain assignment and email sender identity.
 *
 * Deliberately admin-mediated, not self-service: a bad/offensive/reserved
 * subdomain choice is hard to walk back once shared with a partner, and a
 * sending domain must be verified (SPF/DKIM/DMARC) in Resend by hand before
 * it will actually deliver — this endpoint only ever writes the DB value,
 * it doesn't verify anything. Wildcard DNS (*.ROOT_DOMAIN) is live in
 * Vercel, so any subdomain assigned here resolves immediately — this
 * endpoint is the only gate against a bad value going live (this only ever
 * writes the DB values branding/sender resolution read — see
 * lib/partners/branding.ts and lib/email/sender.ts).
 *
 * Each field is independently optional in the body; only the fields present
 * are validated and updated. `subdomain: null`/`''` clears it. The UNIQUE
 * constraint on partners.subdomain (partners_subdomain_key) is the source of
 * truth for collision — caught below rather than pre-checked, avoiding a race.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
    const { partnerId } = await params

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }
    const body = (json ?? {}) as {
      subdomain?: unknown
      email_sender_name?: unknown
      email_sender_domain?: unknown
    }

    const updates: Record<string, string | null> = {}

    // ── subdomain ────────────────────────────────────────────────────────
    if ('subdomain' in body) {
      const raw = body.subdomain
      if (raw === null || raw === '') {
        updates.subdomain = null
      } else if (typeof raw !== 'string') {
        return NextResponse.json({ error: 'subdomain must be a string' }, { status: 400 })
      } else {
        const subdomain = raw.trim().toLowerCase()
        if (!isValidSubdomainFormat(subdomain)) {
          return NextResponse.json(
            { error: 'Use lowercase letters, numbers, and hyphens only (no leading/trailing hyphen)' },
            { status: 400 }
          )
        }
        if (RESERVED_SUBDOMAINS.has(subdomain)) {
          return NextResponse.json({ error: `"${subdomain}" is reserved and can't be used` }, { status: 400 })
        }
        updates.subdomain = subdomain
      }
    }

    // ── email sender name ───────────────────────────────────────────────
    if ('email_sender_name' in body) {
      const raw = body.email_sender_name
      if (raw === null || raw === '') {
        updates.email_sender_name = null
      } else if (typeof raw !== 'string' || raw.trim().length > 200) {
        return NextResponse.json({ error: 'email_sender_name must be a string up to 200 characters' }, { status: 400 })
      } else {
        updates.email_sender_name = raw.trim()
      }
    }

    // ── email sender domain ─────────────────────────────────────────────
    if ('email_sender_domain' in body) {
      const raw = body.email_sender_domain
      if (raw === null || raw === '') {
        updates.email_sender_domain = null
      } else if (typeof raw !== 'string' || !DOMAIN_FORMAT.test(raw.trim().toLowerCase())) {
        return NextResponse.json({ error: 'email_sender_domain must be a valid domain, e.g. mail.example.com' }, { status: 400 })
      } else {
        updates.email_sender_domain = raw.trim().toLowerCase()
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
    }

    const { error } = await supabaseServer
      .from('partners')
      .update(updates)
      .eq('id', partnerId)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That subdomain is already taken' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...updates })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

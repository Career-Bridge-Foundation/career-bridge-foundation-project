/**
 * POST /api/redeem — partner token redemption (downstream half of Partners).
 *
 * A logged-in candidate POSTs { token } (the JWT minted by
 * POST /api/partners/tokens, delivered via …/redeem?token=<jwt>). We verify the
 * token, bind it to the logged-in account by email, provision discipline
 * entitlements, and mark the token redeemed.
 *
 * Auth uses the cookie/SSR client (the logged-in user); all table work uses the
 * service-role client. Mirrors app/api/account/profile/route.ts.
 *
 * Fail-closed ordering: entitlements are provisioned BEFORE the token is marked
 * redeemed, so a failure leaves the token retryable rather than burned. The
 * token / JWT is never logged.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/supabase/server'
import {
  verifyPartnerToken,
  hashPartnerToken,
  PartnerTokenVerificationError,
} from '@/lib/partners/token'
import { ensurePortfolioProfile } from '@/lib/portfolio/ensureProfile'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // 1. AUTH (cookie client)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
    }

    // 2. PARSE BODY
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid request body' },
        { status: 400 }
      )
    }

    const token = (json as { token?: unknown })?.token
    if (typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    // 3. VERIFY TOKEN
    try {
      await verifyPartnerToken(token)
    } catch (e) {
      if (e instanceof PartnerTokenVerificationError) {
        if (e.code === 'EXPIRED') {
          return NextResponse.json({ error: 'token expired' }, { status: 410 })
        }
        // INVALID_SIGNATURE | INVALID_AUDIENCE | INVALID_ISSUER | MALFORMED
        return NextResponse.json({ error: 'invalid token' }, { status: 400 })
      }
      throw e // unexpected → outer catch → 500
    }

    // 4. LOOKUP ROW (service-role)
    const { data: row } = await supabaseServer
      .from('partner_tokens')
      .select('*')
      .eq('token_hash', hashPartnerToken(token))
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'token not found' }, { status: 404 })
    }

    // 5. GUARDS (distinct, in order)
    if (row.revoked_at !== null) {
      return NextResponse.json({ error: 'token revoked' }, { status: 403 })
    }
    if (row.redeemed_at !== null) {
      return NextResponse.json(
        { error: 'token already redeemed' },
        { status: 409 }
      )
    }
    if (new Date(row.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'token expired' }, { status: 410 })
    }

    // 6. STRICT EMAIL BINDING
    // Normalize both sides (lowercase+trim) defensively so the binding doesn't
    // depend on candidate_email having been normalized at insert time.
    if (user.email.toLowerCase().trim() !== row.candidate_email.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'this token is not for your account' },
        { status: 403 }
      )
    }

    // 7. RESOLVE PORTFOLIO
    const displayName =
      row.candidate_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email.split('@')[0]

    await ensurePortfolioProfile(user.id, displayName, supabaseServer)

    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const portfolioId: string | undefined = portfolio?.id
    if (!portfolioId) {
      // ensure just ran — shouldn't happen, but fail closed.
      return NextResponse.json(
        { error: 'could not resolve portfolio' },
        { status: 500 }
      )
    }

    // Carry the partner-set country onto the candidate's profile (older
    // tokens minted before this field existed have row.country === null —
    // leave the profile's country untouched in that case rather than
    // clobbering it with null).
    if (row.country) {
      const { error: countryError } = await supabaseServer
        .from('portfolio_profiles')
        .update({ country: row.country })
        .eq('id', portfolioId)
      if (countryError) {
        console.error('[redeem] failed to set candidate country (non-fatal)', countryError)
      }
    }

    // 8. PROVISION ENTITLEMENTS (idempotent via the unique constraint)
    const rows = row.disciplines.map((discipline: string) => ({
      candidate_id: portfolioId,
      discipline,
      granted_by_partner: row.partner_id,
    }))

    const { error: entError } = await supabaseServer
      .from('candidate_entitlements')
      .upsert(rows, { onConflict: 'candidate_id,discipline' })

    if (entError) {
      console.error('[redeem] failed to provision entitlements', entError)
      // Do NOT mark redeemed — candidate can retry.
      return NextResponse.json(
        { error: 'could not provision entitlements' },
        { status: 500 }
      )
    }

    // 9. MARK REDEEMED (only after entitlements succeeded).
    // The .is('redeemed_at', null) guard makes the mark itself atomic against a
    // concurrent double-redeem race.
    const { error: redeemError } = await supabaseServer
      .from('partner_tokens')
      .update({ redeemed_at: new Date().toISOString(), redeemed_by: portfolioId })
      .eq('id', row.id)
      .is('redeemed_at', null)

    if (redeemError) {
      // Entitlements ARE provisioned — the grant succeeded. The mark is
      // bookkeeping, so don't fail the request; just log it server-side.
      console.error('[redeem] failed to mark token redeemed', redeemError)
    }

    // 10. SUCCESS
    return NextResponse.json({
      ok: true,
      disciplines: row.disciplines,
      portfolio_id: portfolioId,
    })
  } catch (err) {
    console.error('[redeem] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

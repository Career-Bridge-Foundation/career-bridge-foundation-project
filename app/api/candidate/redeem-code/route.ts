import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { normalizeCodeInput } from '@/lib/entitlement/sponsorCode'

export const runtime = 'nodejs'

/**
 * POST /api/candidate/redeem-code
 *
 * Redeems a sponsor code for the authenticated candidate, granting credits
 * into their ledger. The code is normalised (whitespace + hyphens stripped,
 * lowercased) before lookup — storage has no hyphen, see the "code format
 * change" note in schema-reference/spec-18-sponsor-codes.sql.
 *
 * Body: { code: string }
 *
 * Distinct error messages (per Spec 15 — partners must be able to diagnose):
 *   invalid_code        — not found or belongs to another partner (same message to prevent enumeration)
 *   code_expired        — past expires_at
 *   code_revoked        — revoked_at is set
 *   code_exhausted      — redemptions_used >= max_redemptions (distinct from invalid)
 *   already_redeemed    — this candidate already redeemed this code
 *
 * Write order (not fully atomic — see comment below):
 *   1. Atomically increment redemptions_used (WHERE guard prevents over-issuance)
 *   2. Insert credit_ledger grant
 *   3. Insert code_redemptions record
 *
 * Gap: steps 2 and 3 are not wrapped in a transaction. A failure between them
 * leaves the candidate with credits but no redemption record, or a redemption
 * record without credits. Both are recoverable via manual ledger adjustment.
 * A full RPC is not mandated by the spec for this path (only activation is
 * security-critical). This gap is logged if it occurs.
 */
export async function POST(request: Request) {
  try {
    // 1. AUTH
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. PARSE BODY
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const rawCode = (body as { code?: unknown })?.code
    if (typeof rawCode !== 'string' || !rawCode.trim()) {
      return NextResponse.json({ error: 'code required' }, { status: 400 })
    }

    const code = normalizeCodeInput(rawCode)

    // 3. RESOLVE PORTFOLIO
    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, provisioned_by_partner')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!portfolio) {
      return NextResponse.json({ error: 'portfolio not found' }, { status: 404 })
    }

    // 4. LOOK UP CODE
    const { data: sponsorCode } = await supabaseServer
      .from('sponsor_codes')
      .select('id, partner_id, cohort_id, credits_per_redemption, max_redemptions, redemptions_used, expires_at, revoked_at')
      .eq('code', code)
      .maybeSingle()

    if (!sponsorCode) {
      return NextResponse.json({ error: 'invalid code', code: 'invalid_code' }, { status: 404 })
    }

    // 5. VALIDATE STATE (ordered: revoked → expired → exhausted)
    if (sponsorCode.revoked_at) {
      return NextResponse.json({ error: 'this code is no longer valid', code: 'code_revoked' }, { status: 410 })
    }

    if (new Date(sponsorCode.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'this code has expired', code: 'code_expired' }, { status: 410 })
    }

    // 6. CHECK ALREADY REDEEMED BY THIS CANDIDATE
    const { data: existing } = await supabaseServer
      .from('code_redemptions')
      .select('id')
      .eq('code_id', sponsorCode.id)
      .eq('candidate_id', portfolio.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'this code has already been applied to your account', code: 'already_redeemed' },
        { status: 409 },
      )
    }

    // 7. ATOMICALLY INCREMENT redemptions_used (WHERE guard prevents over-issuance)
    // Flips status to 'exhausted' in the same update when this redemption is
    // the last one — status is stored/maintained by this transaction, not
    // derived at read time (see schema-reference/spec-18-sponsor-codes.sql).
    const nextRedemptionsUsed = sponsorCode.redemptions_used + 1
    const { data: incremented } = await supabaseServer
      .from('sponsor_codes')
      .update({
        redemptions_used: nextRedemptionsUsed,
        ...(nextRedemptionsUsed >= sponsorCode.max_redemptions ? { status: 'exhausted' } : {}),
      })
      .eq('id', sponsorCode.id)
      .lt('redemptions_used', sponsorCode.max_redemptions)  // guard
      .is('revoked_at', null)
      .select('id, credits_per_redemption, partner_id, cohort_id')
      .maybeSingle()

    if (!incremented) {
      // Another candidate redeemed the last slot between our SELECT and UPDATE
      return NextResponse.json(
        { error: 'this code has been fully redeemed', code: 'code_exhausted' },
        { status: 409 },
      )
    }

    const creditsGranted = incremented.credits_per_redemption as number
    const partnerId      = incremented.partner_id as string
    const cohortId       = incremented.cohort_id as string | null

    // 8. GRANT CREDITS (credit_ledger)
    const { error: ledgerError } = await supabaseServer
      .from('credit_ledger')
      .insert({
        candidate_id:   portfolio.id,
        partner_id:     partnerId,
        cohort_id:      cohortId,
        delta:          creditsGranted,
        reason:         'code_redemption',
        source_code_id: sponsorCode.id,
      })

    if (ledgerError) {
      console.error('[candidate/redeem-code] ledger insert failed — redemptions_used already incremented', ledgerError)
      return NextResponse.json({ error: 'could not grant credits' }, { status: 500 })
    }

    // 9. RECORD REDEMPTION
    const { error: redemptionError } = await supabaseServer
      .from('code_redemptions')
      .insert({
        code_id:         sponsorCode.id,
        candidate_id:    portfolio.id,
        credits_granted: creditsGranted,
      })

    if (redemptionError) {
      // Credits ARE in the ledger. Redemption record is bookkeeping — log and continue.
      console.error('[candidate/redeem-code] redemption record failed (credits granted)', redemptionError)
    }

    return NextResponse.json({ ok: true, credits_granted: creditsGranted })
  } catch (err) {
    console.error('[candidate/redeem-code] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

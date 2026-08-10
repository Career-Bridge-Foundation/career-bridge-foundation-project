import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { assertMintWithinCeiling, CeilingError } from '@/lib/entitlement/ceiling'
import { generateSponsorCode } from '@/lib/entitlement/sponsorCode'

export const runtime = 'nodejs'

/**
 * GET /api/partner/codes
 *
 * Lists all sponsor codes for the authenticated partner, with redemption
 * counts and a derived status field:
 *   active     — not revoked, not expired, redemptions_used < max_redemptions
 *   exhausted  — redemptions_used >= max_redemptions
 *   expired    — past expires_at (and not revoked)
 *   revoked    — revoked_at is set
 */
export async function GET() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data, error } = await supabaseServer
      .from('sponsor_codes')
      .select('id, code, credits_per_redemption, max_redemptions, redemptions_used, cohort_id, expires_at, created_at, revoked_at')
      .eq('partner_id', ctx.partnerId!)
      .order('created_at', { ascending: false })

    if (error) throw error

    const now = new Date()
    const codes = (data ?? []).map((row) => {
      const isRevoked   = !!row.revoked_at
      const isExpired   = !isRevoked && new Date(row.expires_at as string) <= now
      const isExhausted = !isRevoked && !isExpired && (row.redemptions_used as number) >= (row.max_redemptions as number)
      const status      = isRevoked ? 'revoked' : isExpired ? 'expired' : isExhausted ? 'exhausted' : 'active'

      return {
        ...row,
        reserved_value: (row.credits_per_redemption as number) * (row.max_redemptions as number),
        status,
      }
    })

    return NextResponse.json({ codes })
  } catch (err) {
    console.error('[partner/codes GET] failed', err)
    return NextResponse.json({ error: 'could not load codes' }, { status: 500 })
  }
}

/**
 * POST /api/partner/codes
 *
 * Mints a new sponsor code for the authenticated partner. Ceiling enforcement
 * runs here — rejected if reserved_value would exceed hardCeiling. The code
 * string is auto-generated (human-readable, case-insensitive, stored lowercase).
 *
 * Body: {
 *   credits_per_redemption  integer  required  credits granted per redemption
 *   max_redemptions         integer  required  max candidates who can use this code
 *   expires_at              string   required  ISO date — must be in the future
 *   cohort_id               string   optional  scopes granted credits to a cohort
 * }
 *
 * The UI should display reserved_value (credits_per_redemption × max_redemptions)
 * against remaining ceiling BEFORE the user confirms — show this from
 * GET /api/partner/allocation first.
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const { credits_per_redemption, max_redemptions, expires_at, cohort_id } =
      body as {
        credits_per_redemption?: unknown
        max_redemptions?: unknown
        expires_at?: unknown
        cohort_id?: unknown
      }

    // Validate required fields
    if (!Number.isInteger(credits_per_redemption) || (credits_per_redemption as number) < 1) {
      return NextResponse.json({ error: 'credits_per_redemption must be a positive integer' }, { status: 400 })
    }
    if (!Number.isInteger(max_redemptions) || (max_redemptions as number) < 1) {
      return NextResponse.json({ error: 'max_redemptions must be a positive integer' }, { status: 400 })
    }
    if (typeof expires_at !== 'string' || !expires_at) {
      return NextResponse.json({ error: 'expires_at required' }, { status: 400 })
    }
    const expiresDate = new Date(expires_at)
    if (isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
      return NextResponse.json({ error: 'expires_at must be a valid future date' }, { status: 400 })
    }

    // Validate cohort_id belongs to this partner (if provided)
    if (cohort_id !== undefined && cohort_id !== null) {
      if (typeof cohort_id !== 'string') {
        return NextResponse.json({ error: 'cohort_id must be a UUID string' }, { status: 400 })
      }
      const { data: cohort } = await supabaseServer
        .from('cohorts')
        .select('id')
        .eq('id', cohort_id)
        .eq('partner_id', ctx.partnerId!)
        .maybeSingle()

      if (!cohort) {
        return NextResponse.json({ error: 'cohort not found' }, { status: 404 })
      }
    }

    // Ceiling enforcement — must run before insert
    const reservedValue = (credits_per_redemption as number) * (max_redemptions as number)
    try {
      await assertMintWithinCeiling(ctx.partnerId!, reservedValue)
    } catch (err) {
      if (err instanceof CeilingError) {
        if (err.code === 'no_active_allocation') {
          return NextResponse.json({ error: 'no active allocation — contact Evidentize to set up your credit ceiling' }, { status: 422 })
        }
        if (err.code === 'ceiling_exceeded') {
          return NextResponse.json({ error: err.message, code: 'ceiling_exceeded' }, { status: 422 })
        }
      }
      throw err
    }

    // Generate unique code — retry up to 5 times on collision
    let newCode: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateSponsorCode()
      const { data, error: insErr } = await supabaseServer
        .from('sponsor_codes')
        .insert({
          partner_id:             ctx.partnerId!,
          code,
          credits_per_redemption: credits_per_redemption as number,
          max_redemptions:        max_redemptions as number,
          cohort_id:              cohort_id ?? null,
          expires_at:             expiresDate.toISOString(),
          created_by:             ctx.userId,
        })
        .select('id, code, credits_per_redemption, max_redemptions, cohort_id, expires_at, created_at')
        .maybeSingle()

      if (!insErr && data) {
        newCode = data as Record<string, unknown>
        break
      }

      // Only retry on unique violation; surface other errors immediately
      if (insErr && !insErr.message.includes('unique')) {
        throw insErr
      }
    }

    if (!newCode) {
      return NextResponse.json({ error: 'could not generate a unique code — try again' }, { status: 500 })
    }

    return NextResponse.json({
      code: {
        ...newCode,
        reserved_value: reservedValue,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[partner/codes POST] failed', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

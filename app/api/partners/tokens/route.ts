/**
 * POST /api/partners/tokens — partner-authenticated token minting endpoint.
 *
 * A partner authenticates with their API key (Bearer) and requests a redemption
 * token for a candidate who has paid for discipline access. We sign a partner
 * JWT (lib/partners/token), persist a hash of it in partner_tokens for later
 * revocation/redemption lookup, and return a redemption URL.
 *
 * Server-to-server only: authenticated by API key, NOT a user session, so we
 * use the service-role Supabase client.
 *
 * Security notes:
 *  - All auth failures return the SAME 401 body — no enumeration oracle.
 *  - The full token / JWT is never logged.
 *  - We fail closed: if persistence fails we do NOT return the token (a token
 *    whose row doesn't exist could never be revoked).
 */

import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { getKeyPrefix, verifyApiKeyHash } from '@/lib/partners/apiKey'
import { mintRedemptionToken, MintError } from '@/lib/partners/mint'
import { disciplines } from '@/lib/disciplines-data'
import { COUNTRIES } from '@/lib/countries'

export const runtime = 'nodejs'

const AVAILABLE_DISCIPLINES = disciplines
  .filter((d) => d.status === 'available')
  .map((d) => d.name)

const COUNTRY_CODES = COUNTRIES.map((c) => c.code)

const BodySchema = z.object({
  candidate_email: z.string().email(),
  candidate_name: z.string().min(1).optional(),
  // Set by the partner's own integration, not the candidate — see
  // supabase/migrations/20260809_001_candidate_country.sql.
  country: z.enum(COUNTRY_CODES as [string, ...string[]]),
  disciplines: z
    .array(z.enum(AVAILABLE_DISCIPLINES as [string, ...string[]]))
    .min(1),
  expires_in_days: z.number().int().positive().max(90).optional().default(7),
})

const INVALID_CREDENTIALS = { error: 'invalid credentials' } as const

export async function POST(request: Request) {
  try {
    // Fail early on required server config — before any signing work.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json(
        { error: 'server misconfiguration' },
        { status: 500 }
      )
    }

    // 1. AUTH
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 })
    }
    const key = authHeader.slice('Bearer '.length)
    const prefix = getKeyPrefix(key)

    const { data: row } = await supabaseServer
      .from('partner_api_keys')
      .select('*')
      .eq('key_prefix', prefix)
      .maybeSingle()

    if (
      !row ||
      !verifyApiKeyHash(key, row.key_hash) ||
      row.revoked_at !== null
    ) {
      return NextResponse.json(INVALID_CREDENTIALS, { status: 401 })
    }

    const partnerId: string = row.partner_id

    // Fire-and-forget: record last use. Never block or fail the response on it.
    after(async () => {
      const { error } = await supabaseServer
        .from('partner_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) console.warn('[partners/tokens] last_used_at update failed')
    })

    // 2. VALIDATE BODY
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid request body' },
        { status: 400 }
      )
    }

    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data

    // 3+4. Mint via shared helper (maps names→slugs, signs, persists fail-closed).
    let result
    try {
      result = await mintRedemptionToken({
        partnerId,
        candidateEmail: body.candidate_email,
        candidateName: body.candidate_name ?? null,
        country: body.country,
        disciplineNames: body.disciplines,
        expiresInDays: body.expires_in_days,
        appUrl,
      })
    } catch (err) {
      if (err instanceof MintError) {
        if (err.code === 'terms_not_published') {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
        console.error('[partners/tokens] mint failed', err.code, err.message)
        const msg = err.code === 'persist_failed' ? 'could not persist token' : 'internal error'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
      throw err
    }

    // 5. RESPONSE
    return NextResponse.json(
      {
        redemption_url: result.redemption_url,
        expires_at: result.expires_at,
      },
      { status: 201 }
    )
  } catch (err) {
    // 6. Unexpected errors — log server-side only, never leak details.
    console.error('[partners/tokens] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

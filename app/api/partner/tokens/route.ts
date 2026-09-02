import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { requirePartner } from '@/lib/auth/permissions'
import { availableDisciplineNames } from '@/lib/disciplines-data'
import { mintRedemptionToken, MintError } from '@/lib/partners/mint'
import { sendInvitationEmail } from '@/lib/email/invitations'
import { COUNTRIES } from '@/lib/countries'

export const runtime = 'nodejs'

const COUNTRY_CODES = COUNTRIES.map((c) => c.code)

const BodySchema = z.object({
  candidate_email: z.string().email(),
  candidate_name: z.string().min(1).optional(),
  // Set by the partner, who vetted the candidate at admission — never
  // self-reported, never inferred from IP, never accepted from a candidate-
  // authenticated request (this route is partner-admin only, via
  // requirePartner below, which is the only mint path). Required on every
  // invite, no default — see the country-and-pricing amendment and
  // supabase/migrations/20260809_001_candidate_country.sql.
  country: z.enum(COUNTRY_CODES as [string, ...string[]]),
  disciplines: z
    .array(z.enum(availableDisciplineNames as [string, ...string[]]))
    .min(1),
  expires_in_days: z.number().int().positive().max(90).optional().default(7),
  requires_programme_terms: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 })
    }

    // AUTH — session-based: must be a partner with a linked org.
    let ctx
    try {
      ctx = await requirePartner()
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const partnerId = ctx.partnerId as string

    // VALIDATE BODY
    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data

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
        requiresProgrammeTerms: body.requires_programme_terms,
      })
    } catch (err) {
      if (err instanceof MintError) {
        if (err.code === 'terms_not_published') {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
        const status = err.code === 'persist_failed' ? 500 : 500
        console.error('[partner/tokens] mint failed', err.code, err.message)
        return NextResponse.json({ error: 'could not generate token' }, { status })
      }
      throw err
    }

    // Fire-and-forget: invite email is a delivery convenience, not the source of truth.
    // The minted token is valid regardless; never fail the mint on email error.
    after(() => {
      return sendInvitationEmail({
        to: body.candidate_email,
        inviteUrl: result.redemption_url,
        partnerId,
        expiresInDays: body.expires_in_days ?? 7,
      }).catch((err) => {
        console.error('[partner/tokens] invitation email failed', { partnerId, to: body.candidate_email, err })
      })
    })

    return NextResponse.json(
      {
        redemption_url: result.redemption_url,
        expires_at: result.expires_at,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[partner/tokens] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

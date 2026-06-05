import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePartner } from '@/lib/auth/permissions'
import { disciplines } from '@/lib/disciplines-data'
import { mintRedemptionToken, MintError } from '@/lib/partners/mint'

export const runtime = 'nodejs'

const AVAILABLE_DISCIPLINES = disciplines
  .filter((d) => d.status === 'available')
  .map((d) => d.name)

const BodySchema = z.object({
  candidate_email: z.string().email(),
  candidate_name: z.string().min(1).optional(),
  disciplines: z
    .array(z.enum(AVAILABLE_DISCIPLINES as [string, ...string[]]))
    .min(1),
  expires_in_days: z.number().int().positive().max(90).optional().default(7),
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
        disciplineNames: body.disciplines,
        expiresInDays: body.expires_in_days,
        appUrl,
      })
    } catch (err) {
      if (err instanceof MintError) {
        const status = err.code === 'persist_failed' ? 500 : 500
        console.error('[partner/tokens] mint failed', err.code, err.message)
        return NextResponse.json({ error: 'could not generate token' }, { status })
      }
      throw err
    }

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

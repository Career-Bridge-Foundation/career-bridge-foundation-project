import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { signPartnerToken, hashPartnerToken } from '@/lib/partners/token'
import { disciplines } from '@/lib/disciplines-data'

export const runtime = 'nodejs'

const AVAILABLE_DISCIPLINES = disciplines
  .filter((d) => d.status === 'available')
  .map((d) => d.name)

const DISCIPLINE_NAME_TO_SLUG = new Map(
  disciplines.map((d) => [d.name, d.slug] as const)
)

const BodySchema = z.object({
  candidate_email: z.string().email(),
  candidate_name: z.string().min(1).optional(),
  disciplines: z
    .array(z.enum(AVAILABLE_DISCIPLINES as [string, ...string[]]))
    .min(1),
  expires_in_days: z.number().int().positive().max(90).optional().default(7),
})

// NOTE: minting logic below duplicates app/api/partners/tokens/route.ts.
// This is a deliberate, temporary copy — shared helper extraction is the
// immediate next step. Do not let the two drift in the meantime.
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

    // Map discipline names to canonical slugs.
    const disciplineSlugs: string[] = []
    for (const name of body.disciplines) {
      const slug = DISCIPLINE_NAME_TO_SLUG.get(name)
      if (!slug) {
        console.error('[partner/tokens] no slug for discipline', name)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
      }
      disciplineSlugs.push(slug)
    }

    // SIGN
    const { token, expires_at } = await signPartnerToken({
      partnerId,
      candidateEmail: body.candidate_email,
      candidateName: body.candidate_name ?? null,
      disciplines: disciplineSlugs,
      expiresInSeconds: body.expires_in_days * 86400,
    })

    // PERSIST — fail closed.
    const { error: insertError } = await supabaseServer
      .from('partner_tokens')
      .insert({
        partner_id: partnerId,
        token_hash: hashPartnerToken(token),
        candidate_email: body.candidate_email.toLowerCase().trim(),
        candidate_name: body.candidate_name?.trim() ?? null,
        disciplines: disciplineSlugs,
        expires_at: expires_at.toISOString(),
      })
    if (insertError) {
      console.error('[partner/tokens] failed to persist token row', insertError)
      return NextResponse.json({ error: 'could not persist token' }, { status: 500 })
    }

    return NextResponse.json(
      {
        redemption_url: `${appUrl}/redeem?token=${token}`,
        expires_at: expires_at.toISOString(),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[partner/tokens] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

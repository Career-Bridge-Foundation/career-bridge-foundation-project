import { signPartnerToken, hashPartnerToken } from '@/lib/partners/token'
import { supabaseServer } from '@/lib/supabase/server'
import { disciplines } from '@/lib/disciplines-data'

const DISCIPLINE_NAME_TO_SLUG = new Map(
  disciplines.map((d) => [d.name, d.slug] as const)
)

export class MintError extends Error {
  constructor(
    public code: 'unknown_discipline' | 'persist_failed' | 'terms_not_published',
    message: string
  ) {
    super(message)
    this.name = 'MintError'
  }
}

export type MintParams = {
  partnerId: string
  candidateEmail: string
  candidateName?: string | null
  /** ISO 3166-1 alpha-2, set by the partner — see lib/countries.ts. */
  country: string
  /** Discipline NAMES (e.g. "Cyber Security") — mapped to slugs internally. */
  disciplineNames: string[]
  expiresInDays: number
  appUrl: string
  /** Per-invite choice, default true — whether THIS candidate must accept the partner's own programme terms. */
  requiresProgrammeTerms: boolean
}

export type MintResult = {
  redemption_url: string
  expires_at: string
}

/**
 * Mints a partner redemption token: maps discipline names to slugs, signs a
 * partner JWT, persists a hash to partner_tokens (fail-closed), returns the
 * redemption URL + expiry. Auth and partnerId resolution are the CALLER's
 * responsibility — this function trusts the partnerId it is given.
 */
export async function mintRedemptionToken(params: MintParams): Promise<MintResult> {
  const { partnerId, candidateEmail, candidateName, country, disciplineNames, expiresInDays, appUrl, requiresProgrammeTerms } = params

  // Programme terms are optional per partner now — a partner can simply not
  // have any, in which case only Evidentize's platform terms ever apply.
  // The only thing that's still invalid is requesting requiresProgrammeTerms
  // for a partner who has nothing active to require — can't gate on a
  // document that doesn't exist.
  if (requiresProgrammeTerms) {
    const { data: activeTerms } = await supabaseServer
      .from('terms_documents')
      .select('id')
      .eq('document_type', 'partner_programme_terms')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .maybeSingle()

    if (!activeTerms) {
      throw new MintError(
        'terms_not_published',
        'This partner has no published programme terms — publish a version first, or provision without requiring them.'
      )
    }
  }

  // Map discipline names to canonical slugs (matches simulations table +
  // candidate_entitlements).
  const disciplineSlugs: string[] = []
  for (const name of disciplineNames) {
    const slug = DISCIPLINE_NAME_TO_SLUG.get(name)
    if (!slug) {
      throw new MintError('unknown_discipline', `no slug for discipline: ${name}`)
    }
    disciplineSlugs.push(slug)
  }

  // Sign
  const { token, expires_at } = await signPartnerToken({
    partnerId,
    candidateEmail,
    candidateName: candidateName ?? null,
    disciplines: disciplineSlugs,
    expiresInSeconds: expiresInDays * 86400,
  })

  // Persist — fail closed (an unrevokable token must never be returned).
  const { error: insertError } = await supabaseServer
    .from('partner_tokens')
    .insert({
      partner_id: partnerId,
      token_hash: hashPartnerToken(token),
      candidate_email: candidateEmail.toLowerCase().trim(),
      candidate_name: candidateName?.trim() ?? null,
      country,
      disciplines: disciplineSlugs,
      requires_programme_terms: requiresProgrammeTerms,
      expires_at: expires_at.toISOString(),
    })

  if (insertError) {
    throw new MintError('persist_failed', insertError.message)
  }

  return {
    redemption_url: `${appUrl}/redeem?token=${token}`,
    expires_at: expires_at.toISOString(),
  }
}

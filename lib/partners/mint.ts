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
  const { partnerId, candidateEmail, candidateName, country, disciplineNames, expiresInDays, appUrl } = params

  // Spec 19 edge case: "Invite minted before the partner's document is
  // published: Mint blocked with a clear message. A candidate must not
  // reach a gate with nothing behind it." — the acceptance gate
  // (candidate_has_outstanding_terms / getOutstandingDocuments) skips a
  // partner entirely when it has no active programme terms, so without this
  // check a candidate entitled by such a partner would never be asked to
  // accept anything for them at all — silently bypassing the very
  // commitment this partner invited them to make, not getting stuck.
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
      'This partner has no published programme terms yet — publish a version before provisioning candidates.'
    )
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

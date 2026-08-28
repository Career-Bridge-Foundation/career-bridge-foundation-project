import { supabaseServer } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────
// Outstanding-acceptance resolution (Spec 19). Two kinds of document apply
// to a candidate: the platform terms (always) and, per partner that has
// entitled them, that partner's programme terms (Spec 19 decision: a
// candidate belonging to two partners accepts each partner's terms
// separately — one platform acceptance, one per partner).
//
// Reads portfolio_profiles by `user_id` — the column every shipping route in
// this codebase (app/api/redeem/route.ts, etc.) already reads/writes
// successfully. See the comment on the dynamic view in
// supabase/migrations/20260824_001_candidate_acceptance.sql for why this
// isn't hardcoded there; here it's a plain, loud-if-wrong query (an unknown
// column errors visibly, it doesn't fail silently).
// ─────────────────────────────────────────────────────────────────────────

export type OutstandingDocument = {
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  partnerName: string | null
  version: string
  body: string
  documentHash: string
}

export async function getOutstandingDocuments(userId: string): Promise<OutstandingDocument[]> {
  const outstanding: OutstandingDocument[] = []

  // ── Platform terms — always applicable ──
  const { data: platform } = await supabaseServer
    .from('terms_documents')
    .select('version, body, document_hash')
    .eq('document_type', 'platform_terms')
    .eq('is_active', true)
    .maybeSingle()

  if (platform) {
    const { data: accepted } = await supabaseServer
      .from('candidate_terms_acceptances')
      .select('id')
      .eq('candidate_id', userId)
      .eq('document_type', 'platform_terms')
      .eq('version', platform.version as string)
      .maybeSingle()

    if (!accepted) {
      outstanding.push({
        documentType: 'platform_terms',
        partnerId: null,
        partnerName: null,
        version: platform.version as string,
        body: platform.body as string,
        documentHash: platform.document_hash as string,
      })
    }
  }

  // ── Partner programme terms — one per partner that has entitled this candidate ──
  const { data: profile } = await supabaseServer
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile) {
    const { data: ents } = await supabaseServer
      .from('candidate_entitlements')
      .select('granted_by_partner')
      .eq('candidate_id', profile.id as string)
      .is('revoked_at', null)

    const partnerIds = [...new Set((ents ?? []).map((e) => e.granted_by_partner as string))]

    for (const partnerId of partnerIds) {
      const { data: doc } = await supabaseServer
        .from('terms_documents')
        .select('version, body, document_hash')
        .eq('document_type', 'partner_programme_terms')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .maybeSingle()
      if (!doc) continue // partner has no active programme terms published — nothing to accept for them yet

      const { data: accepted } = await supabaseServer
        .from('candidate_terms_acceptances')
        .select('id')
        .eq('candidate_id', userId)
        .eq('document_type', 'partner_programme_terms')
        .eq('partner_id', partnerId)
        .eq('version', doc.version as string)
        .maybeSingle()
      if (accepted) continue

      const { data: partner } = await supabaseServer
        .from('partners')
        .select('name')
        .eq('id', partnerId)
        .maybeSingle()

      outstanding.push({
        documentType: 'partner_programme_terms',
        partnerId,
        partnerName: (partner?.name as string | null) ?? null,
        version: doc.version as string,
        body: doc.body as string,
        documentHash: doc.document_hash as string,
      })
    }
  }

  return outstanding
}

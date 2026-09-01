import { supabaseServer } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────
// Outstanding-acceptance resolution (Spec 19). Two kinds of document apply
// to a candidate: the platform terms (always) and, per partner that has
// entitled them AND for whom at least one of those entitlements has
// requires_programme_terms = true, that partner's programme terms.
//
// candidate_terms_acceptances.candidate_id has its FK on portfolio_profiles
// (id), NOT auth.users(id) — confirmed against the live database (a real
// insert using an auth.users id was rejected with a foreign-key violation
// naming portfolio_profiles). The profile is resolved ONCE, up front, and
// used for every acceptance lookup below — passing the raw auth `userId`
// straight into a `candidate_id` filter, which this file did until this fix,
// silently matches zero rows forever (never an error, just a permanent
// false "not accepted").
// ─────────────────────────────────────────────────────────────────────────

const BUCKET = 'partner-terms-documents'
const SIGNED_URL_TTL = 3600

export type OutstandingDocument = {
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  partnerName: string | null
  partnerContactEmail: string | null
  version: string
  body: string | null // null when sourceFileType is set (PDF)
  documentHash: string
  sourceFileType: string | null
  signedUrl: string | null
}

export async function getOutstandingDocuments(userId: string): Promise<OutstandingDocument[]> {
  const outstanding: OutstandingDocument[] = []

  // Resolve the portfolio profile ONCE — every acceptance-row lookup below
  // filters on its id, never on the raw auth userId. No profile yet means
  // nothing could possibly be recorded either way (the FK requires a valid
  // profile_id to insert), so there is nothing outstanding to report.
  const { data: profile } = await supabaseServer
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return outstanding
  const profileId = profile.id as string

  // ── Platform terms — always applicable (always text-based) ──
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
      .eq('candidate_id', profileId)
      .eq('document_type', 'platform_terms')
      .eq('version', platform.version as string)
      .maybeSingle()

    if (!accepted) {
      outstanding.push({
        documentType: 'platform_terms',
        partnerId: null,
        partnerName: null,
        partnerContactEmail: null,
        version: platform.version as string,
        body: platform.body as string,
        documentHash: platform.document_hash as string,
        sourceFileType: null,
        signedUrl: null,
      })
    }
  }

  // ── Partner programme terms — one per partner that entitled this
  // candidate WITH requires_programme_terms = true on at least one row ──
  const { data: ents } = await supabaseServer
    .from('candidate_entitlements')
    .select('granted_by_partner')
    .eq('candidate_id', profileId)
    .is('revoked_at', null)
    .eq('requires_programme_terms', true)

  const partnerIds = [...new Set((ents ?? []).map((e) => e.granted_by_partner as string))]

  for (const partnerId of partnerIds) {
    const { data: doc } = await supabaseServer
      .from('terms_documents')
      .select('version, body, document_hash, source_storage_path, source_file_type')
      .eq('document_type', 'partner_programme_terms')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .maybeSingle()
    if (!doc) continue // partner has no active programme terms published — nothing to accept for them yet

    const { data: accepted } = await supabaseServer
      .from('candidate_terms_acceptances')
      .select('id')
      .eq('candidate_id', profileId)
      .eq('document_type', 'partner_programme_terms')
      .eq('partner_id', partnerId)
      .eq('version', doc.version as string)
      .maybeSingle()
    if (accepted) continue

    const { data: partner } = await supabaseServer
      .from('partners')
      .select('name, contact_email')
      .eq('id', partnerId)
      .maybeSingle()

    let signedUrl: string | null = null
    if (doc.source_storage_path) {
      const { data: signed } = await supabaseServer.storage
        .from(BUCKET)
        .createSignedUrl(doc.source_storage_path as string, SIGNED_URL_TTL)
      signedUrl = signed?.signedUrl ?? null
    }

    outstanding.push({
      documentType: 'partner_programme_terms',
      partnerId,
      partnerName: (partner?.name as string | null) ?? null,
      partnerContactEmail: (partner?.contact_email as string | null) ?? null,
      version: doc.version as string,
      body: (doc.body as string | null) ?? null,
      documentHash: doc.document_hash as string,
      sourceFileType: (doc.source_file_type as string | null) ?? null,
      signedUrl,
    })
  }

  return outstanding
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Records acceptance of whatever's CURRENTLY active at call time — platform
 * terms always, the partner's programme terms only if requiresProgrammeTerms.
 * Used by POST /api/redeem right after a brand-new candidate authenticates
 * (folding what used to be a separate /accept-terms visit into the same
 * flow) and reuses the exact verify-hash-then-RPC shape POST
 * /api/candidate/accept already has.
 *
 * `sessionClient` MUST be the caller's own per-request session client (not
 * supabaseServer) — record_candidate_acceptance() derives candidate_id from
 * auth.uid(), which only resolves under the caller's own session.
 *
 * Best-effort by design: never throws. If a document was deactivated
 * between the redeem preview and this call, or the RPC fails for any
 * reason, the candidate simply hits the ordinary /accept-terms gate on
 * their very next request — that gate is the authoritative backstop
 * regardless of whether this inline convenience path succeeds.
 */
export async function recordAcceptanceForActiveVersions(params: {
  sessionClient: SupabaseClient
  partnerId: string
  requiresProgrammeTerms: boolean
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  const { sessionClient, partnerId, requiresProgrammeTerms, ip, userAgent } = params

  try {
    const acceptances: { document_type: string; partner_id: string | null; version: string; document_hash: string }[] = []

    const { data: platform } = await supabaseServer
      .from('terms_documents')
      .select('version, document_hash')
      .eq('document_type', 'platform_terms')
      .eq('is_active', true)
      .maybeSingle()
    if (platform) {
      acceptances.push({
        document_type: 'platform_terms',
        partner_id: null,
        version: platform.version as string,
        document_hash: platform.document_hash as string,
      })
    }

    if (requiresProgrammeTerms) {
      const { data: programme } = await supabaseServer
        .from('terms_documents')
        .select('version, document_hash')
        .eq('document_type', 'partner_programme_terms')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .maybeSingle()
      if (programme) {
        acceptances.push({
          document_type: 'partner_programme_terms',
          partner_id: partnerId,
          version: programme.version as string,
          document_hash: programme.document_hash as string,
        })
      }
    }

    if (!acceptances.length) return

    const { error } = await sessionClient.rpc('record_candidate_acceptance', {
      p_acceptances: acceptances,
      p_ip: ip,
      p_user_agent: userAgent,
    })
    if (error) {
      console.error('[recordAcceptanceForActiveVersions] rpc failed (non-fatal)', error.message)
    }
  } catch (err) {
    console.error('[recordAcceptanceForActiveVersions] unexpected error (non-fatal)', err)
  }
}

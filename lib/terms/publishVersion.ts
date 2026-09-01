import { supabaseServer } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { resolvePartnerSender } from '@/lib/email/sender'
import { renderTermsVersionPublishedEmail } from '@/lib/email/templates/terms-version-published'

export type PublishVersionParams = {
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  version: string
  documentHash: string
  createdBy: string
  // Exactly one of these two — enforced by terms_documents_one_source at the DB layer too.
  body: string | null
  sourceStoragePath: string | null
  sourceFileType: string | null
}

export type PublishVersionResult =
  | { ok: true; document: { id: string; version: string; published_at: string } }
  | { ok: false; status: number; error: string }

/**
 * Shared deactivate-then-insert-then-notify logic behind BOTH publish
 * routes (super-admin's platform-terms-only endpoint, and a partner's own
 * programme-terms endpoint) — same append-only, never-edited-in-place
 * model either way; only who's allowed to call it and which document_type
 * they're restricted to differs at the route level, not here.
 */
export async function publishTermsVersion(params: PublishVersionParams): Promise<PublishVersionResult> {
  const { documentType, partnerId, version, documentHash, createdBy, body, sourceStoragePath, sourceFileType } = params

  // Capture the version being superseded (if any) BEFORE deactivating it —
  // needed afterward to find candidates who accepted exactly that version,
  // for the re-prompt notice.
  let supersededVersion: string | null = null
  {
    let query = supabaseServer
      .from('terms_documents')
      .select('version')
      .eq('document_type', documentType)
      .eq('is_active', true)
    query = partnerId ? query.eq('partner_id', partnerId) : query.is('partner_id', null)
    const { data: previouslyActive } = await query.maybeSingle()
    supersededVersion = (previouslyActive?.version as string | null) ?? null
  }

  // Two-step, not atomic (per this repo's convention for multi-row writes
  // that aren't wrapped in an RPC — CLAUDE.md "Database-touching code"):
  // deactivate the currently-active version first, then insert the new one
  // active. A failure between the two leaves NO active version rather than
  // two — fail-safe in the direction of re-prompting rather than silently
  // skipping the gate.
  const { error: deactivateError } = await supabaseServer
    .from('terms_documents')
    .update({ is_active: false })
    .eq('document_type', documentType)
    .eq('is_active', true)
    .filter('partner_id', partnerId ? 'eq' : 'is', partnerId ?? null)

  if (deactivateError) {
    console.error('[publishTermsVersion] deactivate failed', deactivateError.message)
    return { ok: false, status: 500, error: deactivateError.message }
  }

  const { data: created, error: insertError } = await supabaseServer
    .from('terms_documents')
    .insert({
      document_type: documentType,
      partner_id: partnerId,
      version,
      body,
      source_storage_path: sourceStoragePath,
      source_file_type: sourceFileType,
      document_hash: documentHash,
      is_active: true,
      created_by: createdBy,
    })
    .select('id, version, published_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, status: 409, error: 'that version already exists for this document' }
    }
    console.error('[publishTermsVersion] insert failed', insertError.message)
    return { ok: false, status: 500, error: insertError.message }
  }

  // Best-effort re-prompt notice to candidates who accepted the superseded
  // version — never blocks or fails the publish response (Spec 19
  // notifications table: advance notice, not a gate).
  if (supersededVersion) {
    notifySupersededAcceptors({ documentType, partnerId, supersededVersion }).catch((err) =>
      console.error('[publishTermsVersion] re-prompt notice failed (non-fatal)', err)
    )
  }

  return {
    ok: true,
    document: created as { id: string; version: string; published_at: string },
  }
}

async function notifySupersededAcceptors(params: {
  documentType: 'platform_terms' | 'partner_programme_terms'
  partnerId: string | null
  supersededVersion: string
}) {
  const { documentType, partnerId, supersededVersion } = params

  let query = supabaseServer
    .from('candidate_terms_acceptances')
    .select('candidate_id')
    .eq('document_type', documentType)
    .eq('version', supersededVersion)
  query = partnerId ? query.eq('partner_id', partnerId) : query.is('partner_id', null)
  const { data: acceptors } = await query

  // candidate_terms_acceptances.candidate_id is a portfolio_profiles.id, not
  // an auth.users.id (confirmed against the live FK) — resolve to user_id
  // before calling the admin API, or getUserById silently returns nothing
  // for every candidate and no re-prompt email ever sends.
  const profileIds = [...new Set((acceptors ?? []).map((a) => a.candidate_id as string))]
  if (!profileIds.length) return

  const { data: profiles } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id')
    .in('id', profileIds)
  const userIds = (profiles ?? []).map((p) => p.user_id as string)
  if (!userIds.length) return

  const sender = await resolvePartnerSender(documentType === 'platform_terms' ? null : partnerId)
  const documentLabel =
    documentType === 'platform_terms' ? 'Evidentize Platform Terms of Service' : `${sender.partnerName} Programme Terms`
  const html = renderTermsVersionPublishedEmail({ documentLabel, senderName: sender.partnerName })
  const subject = `Updated: ${documentLabel}`

  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabaseServer.auth.admin.getUserById(userId)
      const email = data?.user?.email
      if (!email) return
      return sendEmail({ to: email, from: sender.from, subject, html }).catch((err) =>
        console.error('[publishTermsVersion] re-prompt send failed', userId, err)
      )
    })
  )
}

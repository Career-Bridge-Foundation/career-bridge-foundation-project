import { supabaseServer } from '@/lib/supabase/server'

/**
 * Records a partner admin's view of a candidate's detail (raw submission access).
 * Awaited so the audit row flushes before the serverless response ends, but
 * never-throw: an audit-logging failure must not break the view.
 */
export async function logCandidateAccess(opts: {
  partnerId: string
  viewerId: string
  viewerEmail: string | null
  candidateId: string
}): Promise<void> {
  try {
    await supabaseServer.from('partner_candidate_access_log').insert({
      partner_id: opts.partnerId,
      viewer_id: opts.viewerId,
      viewer_email: opts.viewerEmail,
      candidate_id: opts.candidateId,
    })
  } catch {
    // never throw — audit logging must not break the candidate detail view
  }
}

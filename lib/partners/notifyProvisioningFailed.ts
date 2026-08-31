import { supabaseServer } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { renderProvisioningFailedEmail } from '@/lib/email/templates/provisioning-failed'

/**
 * Spec 19 notification: "Provisioning terminally failed → Partner-admin →
 * Names the candidate; manual action required." Called from wherever
 * provisioning_status actually transitions to 'failed' — today that's only
 * the manual mark-failed endpoint (see app/api/partner/candidates/
 * [candidateId]/mark-failed/route.ts); a future automated provisioning
 * worker should call this same function on its own terminal failure so the
 * alert behaves identically regardless of what caused it.
 *
 * Sent to the partner's own contact_email (the same field used everywhere
 * else in this codebase as "the partner's contact route") — never blocks
 * the caller; failures here are logged, not thrown.
 */
export async function notifyProvisioningFailed(candidateId: string, partnerId: string): Promise<void> {
  try {
    const [{ data: candidate }, { data: partner }] = await Promise.all([
      supabaseServer.from('portfolio_profiles').select('user_id').eq('id', candidateId).maybeSingle(),
      supabaseServer.from('partners').select('contact_email').eq('id', partnerId).maybeSingle(),
    ])

    if (!candidate?.user_id || !partner?.contact_email) return

    const [{ data: profile }, { data: authUser }] = await Promise.all([
      supabaseServer.from('profiles').select('full_name').eq('id', candidate.user_id).maybeSingle(),
      supabaseServer.auth.admin.getUserById(candidate.user_id as string),
    ])

    const candidateName =
      (profile?.full_name as string | null) || authUser?.user?.email || 'A candidate'

    const html = renderProvisioningFailedEmail({ candidateName })

    await sendEmail({
      to: partner.contact_email as string,
      from: 'Evidentize <noreply@email.evidentize.io>',
      subject: `Community provisioning failed for ${candidateName}`,
      html,
    })
  } catch (err) {
    console.error('[notifyProvisioningFailed] failed to send (non-fatal)', err)
  }
}

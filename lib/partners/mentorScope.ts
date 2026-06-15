import { supabaseServer } from '@/lib/supabase/server'

/**
 * Isolation check shared by every mentor-management write handler: is
 * `mentorUserId` a mentor OF THIS partner?
 *
 * The write routes force `partner_id` from ctx, so this is the gate that stops
 * a partner-admin from mutating another org's mentor rows. Returns true ONLY
 * for an exact (role='mentor', partner_id=partnerId) match. Mirrors the
 * partner-scoping discipline: the caller supplies the authenticated partner's
 * own id (requirePartner()); never a partnerId from user input.
 */
export async function verifyMentorBelongsToPartner(
  mentorUserId: string,
  partnerId: string
): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('user_roles')
    .select('user_id')
    .eq('user_id', mentorUserId)
    .eq('role', 'mentor')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

import { supabaseServer } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/auth/permissions'

/**
 * Shared core of every role elevation: the upsert into `user_roles`.
 *
 * This is ONLY the write. Callers own their own gating around it:
 *  - auth (requirePartner / requireSuperAdmin / future invite-accept)
 *  - the user lookup (resolveUserByEmail is still duplicated in the two
 *    callers — extract when convenient)
 *  - any partner-scoped hijack guard (lives inline in the partner-scoped
 *    caller, NOT here — a super-admin must be able to overwrite)
 *
 * `permissions: {}` and `onConflict: 'user_id'` are the MVP constants both
 * callers already hardcode. We always `.select('role, partner_id')` and
 * return the written row so partner-scoped callers can assert scoping; a
 * caller that doesn't need it simply ignores the return.
 *
 * Returns the raw supabase `{ data, error }` so callers keep their exact
 * error handling (both currently map error -> 500 { error: err.message }).
 */
export function elevateUser(params: {
  targetUserId: string
  email: string | undefined
  role: UserRole
  partnerId: string | null
  grantedBy: string
}) {
  const { targetUserId, email, role, partnerId, grantedBy } = params
  return supabaseServer
    .from('user_roles')
    .upsert(
      {
        user_id: targetUserId,
        email,
        role,
        permissions: {},
        partner_id: partnerId,
        granted_by: grantedBy,
      },
      { onConflict: 'user_id' }
    )
    .select('role, partner_id')
    .maybeSingle()
}

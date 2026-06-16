/**
 * Shared cross-org hijack guard for partner-scoped elevations.
 *
 * A partner-scoped elevation (mentor-users, partner sub-admin invite-accept)
 * must NOT overwrite a user who already belongs to ANOTHER org, or who holds a
 * role outside the caller's allowlist. Only an unaffiliated user (no role) or
 * one whose existing role is in `allowedRoles` AND (if partner-linked) belongs
 * to THIS partner may be elevated.
 *
 * The cross-org `partner_id`-mismatch check is generic; the role allowlist is
 * caller-specific:
 *   - mentor-users      → allowedRoles: ['candidate', 'mentor']
 *   - invite-accept     → allowedRoles: ['candidate']
 *
 * Returns true when the elevation is BLOCKED (caller maps to 409). Extracted
 * verbatim from mentor-users' inline guard — the `existing.partner_id &&`
 * truthiness is preserved exactly (a null/empty partner_id short-circuits to
 * "not cross-org"), so the behavior is byte-identical for that caller.
 */
export function isCrossOrgHijack(args: {
  existing: { role: string; partner_id: string | null } | null
  partnerId: string
  allowedRoles: string[]
}): boolean {
  const { existing, partnerId, allowedRoles } = args
  return (
    !!existing &&
    ((!!existing.partner_id && existing.partner_id !== partnerId) ||
      !allowedRoles.includes(existing.role))
  )
}

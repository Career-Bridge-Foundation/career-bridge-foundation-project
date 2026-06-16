import { randomUUID } from 'node:crypto'
import { hashPartnerToken } from '@/lib/partners/token'

/**
 * Opaque partner-invite token primitives.
 *
 * Unlike the candidate redemption token, an invite is NOT a JWT: the
 * partner_invites row carries invited_email / partner_id / expires_at, so
 * signed claims would be redundant. The token is an opaque, unguessable random
 * string; only its sha256 hash is stored (token_hash), looked up on accept.
 */

/** Generate an opaque invite token (~244 bits of entropy from two v4 UUIDs). */
export function generateInviteToken(): string {
  return randomUUID() + randomUUID()
}

/**
 * Hash an invite token for storage/lookup in partner_invites.token_hash.
 * Reuses the generic sha256 hasher from the candidate-token module so there is
 * exactly one hashing implementation across partner tokens and invites.
 */
export const hashInviteToken = hashPartnerToken

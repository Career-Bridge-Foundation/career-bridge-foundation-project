import { randomInt } from 'crypto'

// Unambiguous character set — excludes 0/O and 1/I to prevent misreading.
// Matches CHARS in schema-reference/spec-18-mint-rpc.sql exactly.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// CSPRNG — Math.random() is not suitable for a value that gates real credits
// (Spec 18 flags this as security-critical: "must be a CSPRNG, not Math.random()").
function segment(n: number): string {
  return Array.from(
    { length: n },
    () => CHARS[randomInt(CHARS.length)],
  ).join('')
}

/**
 * Generates a sponsor code suffix in the PREFIX-XXXXXXXX format (Spec 18
 * decision 3): an 8-character CSPRNG suffix over the unambiguous alphabet,
 * ~10^12 possibilities per prefix.
 *
 * NOT used by the mint route directly — actual minting happens inside the
 * mint_sponsor_codes() RPC (schema-reference/spec-18-mint-rpc.sql), which
 * generates and retries-on-collision within the same transaction that
 * reserves ceiling headroom. This is exported for anywhere else that needs
 * a code shape (tests, previews) without hitting the database.
 *
 * Returns the storage form: prefix + suffix, concatenated, lowercase, no
 * hyphen — see the "code format change" note in
 * schema-reference/spec-18-sponsor-codes.sql for why there's no hyphen in
 * storage. Use formatCodeForDisplay() to render it as PREFIX-XXXXXXXX.
 */
export function generateSponsorCode(prefix: string): string {
  return `${prefix}${segment(8)}`.toLowerCase()
}

/**
 * Renders a stored (hyphen-less) code for display as PREFIX-XXXXXXXX.
 */
export function formatCodeForDisplay(code: string, prefix: string): string {
  return `${prefix.toUpperCase()}-${code.slice(prefix.length).toUpperCase()}`
}

/**
 * Normalizes candidate-entered code text for lookup: strips whitespace and
 * hyphens, lowercases (Spec 18: "candidates will type them with spaces and
 * lowercase"). Storage has no hyphen (see above), so stripping the hyphen
 * from user input is what makes "CBF25-A3F9K2M8", "cbf25a3f9k2m8" and
 * "cbf25 a3f9 k2m8" all resolve to the same stored value.
 */
export function normalizeCodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, '').toLowerCase()
}

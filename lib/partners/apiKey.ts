import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const KEY_LABEL = 'cbf_live_';
const RANDOM_BYTES = 32; // 256 bits of entropy
const PREFIX_RANDOM_CHARS = 8; // chars of the random portion exposed for lookup

export interface GeneratedApiKey {
  /** Full key `cbf_live_<base64url>`. Surfaced to the partner exactly once at creation. Never persist or log this. */
  fullKey: string;
  /** `cbf_live_` + first 8 random chars. Non-secret locator, stored unhashed for fast lookup. */
  keyPrefix: string;
  /** SHA-256 hex digest of fullKey. Stored in partner_api_keys.key_hash. */
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  const fullKey = `${KEY_LABEL}${random}`;
  return { fullKey, keyPrefix: getKeyPrefix(fullKey), keyHash: hashApiKey(fullKey) };
}

export function hashApiKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

export function getKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, KEY_LABEL.length + PREFIX_RANDOM_CHARS);
}

export function verifyApiKeyHash(candidateKey: string, storedHash: string): boolean {
  const candidate = createHash('sha256').update(candidateKey).digest();
  const stored = Buffer.from(storedHash, 'hex');
  if (stored.length !== candidate.length) return false; // malformed/wrong-length hash, no throw
  return timingSafeEqual(candidate, stored);
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Spec 19: partner community API credentials (a Circle admin token, e.g.) are
// an explicit, narrow exception to "never store partner secrets" —
// "encrypted at rest, never returned by any API, never rendered beyond a
// masked last-four, with a documented rotation path." This is that
// encryption. Requires COMMUNITY_CREDENTIAL_ENCRYPTION_KEY: a 32-byte key,
// base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Rotating the key itself would invalidate every already-stored credential —
// treat it as a one-time setup value, not something to change casually.

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.COMMUNITY_CREDENTIAL_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('COMMUNITY_CREDENTIAL_ENCRYPTION_KEY is not set')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('COMMUNITY_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  return key
}

/** Encrypts a plaintext credential. Stored format: base64(iv):base64(authTag):base64(ciphertext). */
export function encryptCredential(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // GCM standard IV size
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

/** Decrypts a value produced by encryptCredential. Server-side only — never expose the result to a client response. */
export function decryptCredential(stored: string): string {
  const key = getKey()
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('malformed stored credential')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

export function lastFour(plaintext: string): string {
  return plaintext.slice(-4)
}

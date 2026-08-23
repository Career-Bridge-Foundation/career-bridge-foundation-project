import { randomInt } from 'crypto'

// Unambiguous character set — excludes 0/O and 1/I to prevent misreading
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// CSPRNG — Math.random() is not suitable for a value that gates real credits
// (Spec 18 flags this as security-critical: "must be a CSPRNG, not Math.random()").
function segment(n: number): string {
  return Array.from(
    { length: n },
    () => CHARS[randomInt(CHARS.length)],
  ).join('')
}

// Produces codes like ABCD-EF3H — uppercase at generation, stored lowercase per schema CHECK.
export function generateSponsorCode(): string {
  return `${segment(4)}-${segment(4)}`.toLowerCase()
}

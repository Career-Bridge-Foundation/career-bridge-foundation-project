// Unambiguous character set — excludes 0/O and 1/I to prevent misreading
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function segment(n: number): string {
  return Array.from(
    { length: n },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join('')
}

// Produces codes like ABCD-EF3H — uppercase at generation, stored lowercase per schema CHECK.
export function generateSponsorCode(): string {
  return `${segment(4)}-${segment(4)}`.toLowerCase()
}

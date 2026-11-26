// Shared between the support page (client) and the API route (server).
// These values must match the Zoho Desk configuration EXACTLY — Zoho rejects
// tickets with values it doesn't know (note the spaces in "Account / Login").

export const TICKET_CATEGORIES = ['Bug', 'Account / Login', 'Feature Request', 'Other'] as const
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const DEFAULT_PRIORITY: TicketPriority = 'Medium'

export const SUBJECT_MIN = 3
export const SUBJECT_MAX = 255
export const DESCRIPTION_MIN = 10
export const DESCRIPTION_MAX = 10_000
export const CONTEXT_PATH_MAX = 300

/** Candidate-facing labels for each category. The value sent to Zoho is the key. */
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  Bug: 'Something isn’t working',
  'Account / Login': 'Account or login problem',
  'Feature Request': 'Suggest an improvement',
  Other: 'Something else',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  Low: 'Low: minor, no rush',
  Medium: 'Medium: getting in my way',
  High: 'High: I can’t complete something',
  Urgent: 'Urgent: I’m completely blocked',
}

/**
 * Accept only a same-site relative path (e.g. "/simulations/abc"). Anything
 * else (absolute URLs, protocol-relative "//", backslash tricks, overlong
 * values) returns null. Used for the optional "where were you" context, which
 * is both written into the ticket and used for the "Back" link.
 */
export function sanitizeContextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v || v.length > CONTEXT_PATH_MAX) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(v)) return null
  return v
}

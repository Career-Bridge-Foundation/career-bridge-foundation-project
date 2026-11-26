import 'server-only'
import { clearAccessToken, getAccessToken } from './zoho-auth'
import { getZohoConfig } from './zoho-config'
import type { TicketCategory, TicketPriority } from './ticket-options'

export type NewZohoTicket = {
  subject: string
  /** Already-built, already-escaped HTML. */
  description: string
  category: TicketCategory
  priority: TicketPriority
  /** From the server-side session, never from the request body. */
  email: string
  /** From the server-side session / profile. */
  name: string
}

const SOURCE_LABEL = 'Career Bridge'

/** Zoho requires contact.lastName: last word → lastName, the rest → firstName. */
export function splitName(name: string, fallback: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const lastName = parts.pop() || fallback
  const firstName = parts.length ? parts.join(' ') : undefined
  return { firstName, lastName }
}

export async function createZohoTicket(t: NewZohoTicket) {
  const cfg = getZohoConfig()
  const { firstName, lastName } = splitName(t.name, t.email)

  const body = JSON.stringify({
    subject: t.subject,
    description: t.description,
    departmentId: cfg.departmentId,
    priority: t.priority,
    category: t.category,
    channel: 'Web',
    email: t.email,
    contact: { email: t.email, firstName, lastName },
    cf: { [cfg.sourceField]: SOURCE_LABEL },
  })

  const send = async () =>
    fetch(`https://desk.zoho.${cfg.dc}/api/v1/tickets`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${await getAccessToken()}`,
        orgId: cfg.orgId,
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

  let res = await send()
  if (res.status === 401) {
    // Cached token was revoked or expired early: refresh and retry once.
    clearAccessToken()
    res = await send()
  }

  const data = (await res.json().catch(() => null)) as
    | { id?: string; ticketNumber?: string; errorCode?: string; message?: string }
    | null
  if (!res.ok || !data?.id || !data?.ticketNumber) {
    const detail = [data?.errorCode, data?.message].filter(Boolean).join(': ')
    throw new Error(`Zoho ticket creation failed: ${detail || `HTTP ${res.status}`}`)
  }
  return { id: String(data.id), ticketNumber: String(data.ticketNumber) }
}

/** Escape user-supplied text for Zoho's HTML description, converting newlines to <br>. */
export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>')
}

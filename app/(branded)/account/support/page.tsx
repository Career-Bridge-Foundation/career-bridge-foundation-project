import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitizeContextPath, TICKET_CATEGORIES, type TicketCategory } from '@/lib/support/ticket-options'
import { SupportPageContent } from './SupportPageContent'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Help & Support',
}

/**
 * /account/support: logged-in "Report a problem" page → Zoho Desk.
 *
 * Optional query params, so other pages can deep-link here:
 *   ?from=/some/path           where the user was (written into the ticket, used for "Back")
 *   ?category=Account%20/%20Login   pre-select a category (must match the allowlist)
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; category?: string | string[] }>
}) {
  const params = await searchParams
  const from = sanitizeContextPath(first(params.from))
  const categoryParam = first(params.category)
  const initialCategory = (TICKET_CATEGORIES as readonly string[]).includes(categoryParam ?? '')
    ? (categoryParam as TicketCategory)
    : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (initialCategory) qs.set('category', initialCategory)
    const next = `/account/support${qs.size ? `?${qs}` : ''}`
    redirect(`/auth/login?next=${encodeURIComponent(next)}`)
  }

  return (
    <SupportPageContent
      email={user.email ?? ''}
      from={from}
      initialCategory={initialCategory}
    />
  )
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

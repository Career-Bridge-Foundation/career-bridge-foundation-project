import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOutstandingDocuments } from '@/lib/terms/acceptanceStatus'

export const runtime = 'nodejs'

/**
 * GET /api/candidate/acceptance-status — outstanding documents (with full
 * bodies) for the authenticated candidate. Any authenticated user may call
 * this (it only ever returns THEIR OWN outstanding set); non-candidates
 * simply get platform_terms plus whichever partner programme terms their
 * own entitlements happen to match, which in practice is empty for staff.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outstanding = await getOutstandingDocuments(user.id)

  return NextResponse.json({
    outstanding: outstanding.map((d) => ({
      document_type: d.documentType,
      partner_id: d.partnerId,
      partner_name: d.partnerName,
      partner_contact_email: d.partnerContactEmail,
      version: d.version,
      body: d.body,
    })),
  })
}

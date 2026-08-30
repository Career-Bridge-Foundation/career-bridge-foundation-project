import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerCandidateProgress } from '@/lib/partners/candidateProgress'
import { getPartnerCandidateAcceptanceStatus } from '@/lib/partners/candidateAcceptanceStatus'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/partner/candidates — matches Spec 19's own named API surface:
 * "list with acceptance and provisioning status." Previously this data only
 * existed inline in app/partner/page.tsx's server-component fetch, with no
 * callable endpoint at this path — this route exposes the identical data
 * (same two functions the page itself calls) as JSON, session-authenticated
 * the same way every other /api/partner/* route is.
 */
export async function GET() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const candidates = await getPartnerCandidateProgress(ctx.partnerId!)

    const acceptance = await getPartnerCandidateAcceptanceStatus(
      ctx.partnerId!,
      candidates.map((c) => c.candidateId)
    )
    const acceptanceByCandidate = new Map(acceptance.map((a) => [a.candidateId, a]))
    const withAcceptance = candidates.map((c) => {
      const a = acceptanceByCandidate.get(c.candidateId)
      return {
        candidate_id: c.candidateId,
        user_id: c.userId,
        slug: c.slug,
        full_name: c.fullName,
        email: c.email,
        disciplines: c.disciplines,
        simulations: c.simulations,
        provisioning_status: c.provisioningStatus,
        community_member_id: c.communityMemberId,
        platform_terms_accepted: a?.platformTermsAccepted ?? null,
        programme_terms_accepted: a?.programmeTermsAccepted ?? null,
      }
    })

    const { data: partnerRow } = await supabaseServer
      .from('partners')
      .select('community_enabled')
      .eq('id', ctx.partnerId!)
      .maybeSingle()

    return NextResponse.json({
      candidates: withAcceptance,
      community_enabled: !!partnerRow?.community_enabled,
    })
  } catch (err) {
    console.error('[partner/candidates GET] failed', err)
    return NextResponse.json({ error: 'could not load candidates' }, { status: 500 })
  }
}

import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerCandidateProgress, type PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { getPartnerCandidateAcceptanceStatus } from '@/lib/partners/candidateAcceptanceStatus'
import { supabaseServer } from '@/lib/supabase/server'
import { SecureAccountBanner } from '@/components/ui/SecureAccountBanner'
import { CandidatesTabs } from './_candidates-tabs'

export const dynamic = 'force-dynamic'

export default async function PartnerCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { welcome } = await searchParams
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner')
  }

  let candidates: PartnerCandidateWithProgress[] = []
  let loadError = false
  let communityEnabled = false
  try {
    // requirePartner guarantees a non-null partnerId.
    candidates = await getPartnerCandidateProgress(ctx.partnerId!)

    const acceptance = await getPartnerCandidateAcceptanceStatus(
      ctx.partnerId!,
      candidates.map((c) => c.candidateId)
    )
    const acceptanceByCandidate = new Map(acceptance.map((a) => [a.candidateId, a]))
    candidates = candidates.map((c) => {
      const a = acceptanceByCandidate.get(c.candidateId)
      return a
        ? { ...c, platformTermsAccepted: a.platformTermsAccepted, programmeTermsAccepted: a.programmeTermsAccepted }
        : c
    })

    const { data: partnerRow } = await supabaseServer
      .from('partners')
      .select('community_enabled')
      .eq('id', ctx.partnerId!)
      .maybeSingle()
    communityEnabled = !!partnerRow?.community_enabled
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-8">
      {welcome === '1' && <SecureAccountBanner />}
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Candidates</p>
        <h1 className="text-2xl font-bold text-navy">Your candidates</h1>
        <p className="mt-1 text-sm text-slate-600">
          View and manage the candidates you've provisioned, or add a new one.
        </p>
      </header>

      <CandidatesTabs candidates={candidates} loadError={loadError} communityEnabled={communityEnabled} />
    </div>
  )
}

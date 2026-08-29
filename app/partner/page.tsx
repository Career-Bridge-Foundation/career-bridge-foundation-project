import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerCandidateProgress, type PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { getPartnerCandidateAcceptanceStatus } from '@/lib/partners/candidateAcceptanceStatus'
import { supabaseServer } from '@/lib/supabase/server'
import { SecureAccountBanner } from '@/components/ui/SecureAccountBanner'
import { MintForm } from './_mint-form'
import { CandidatesPanel } from './_candidates-panel'

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
          {candidates.length > 0
            ? `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} provisioned`
            : 'Provision candidates to give them access to simulations.'}
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your candidates right now. Please refresh — if this keeps happening, contact support.
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-slate-900">No candidates yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Provision your first candidate below — they’ll receive an invite to start their simulations.
          </p>
        </div>
      ) : (
        <CandidatesPanel candidates={candidates} showAdminColumns communityEnabled={communityEnabled} />
      )}

      <MintForm />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { requireMentor } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { getPartnerCandidateProgress, type PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'
import { SecureAccountBanner } from '@/components/ui/SecureAccountBanner'
import { CandidatesPanel } from '@/app/partner/_candidates-panel'

export const dynamic = 'force-dynamic'

export default async function MentorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { welcome } = await searchParams
  let ctx
  try {
    ctx = await requireMentor()
  } catch {
    redirect('/auth/login?next=/mentor')
  }

  // The mentor's assigned candidates (defensive partner scope; active only).
  const { data: assigned } = await supabaseServer
    .from('mentor_candidates')
    .select('candidate_user_id')
    .eq('mentor_user_id', ctx.userId)
    .eq('partner_id', ctx.partnerId!)
    .is('revoked_at', null)
  const candidateUserIds = (assigned ?? []).map((a) => a.candidate_user_id as string)

  let candidates: PartnerCandidateWithProgress[] = []
  let loadError = false
  if (candidateUserIds.length) {
    try {
      // PROGRESS primitive (verdict + score + status). NOT getPartnerCandidateDetail
      // (raw submissions) — mentors see outcomes, not candidate submissions.
      candidates = await getPartnerCandidateProgress(ctx.partnerId!, { candidateUserIds })
    } catch {
      loadError = true
    }
  }

  return (
    <div className="space-y-8">
      {welcome === '1' && <SecureAccountBanner />}
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Candidates</p>
        <h1 className="text-2xl font-bold text-navy">Your candidates</h1>
        <p className="mt-1 text-sm text-slate-600">The candidates assigned to you and their simulation progress.</p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your candidates right now. Please refresh.
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No candidates assigned to you yet.
        </div>
      ) : (
        <CandidatesPanel candidates={candidates} linkDetail={false} />
      )}
    </div>
  )
}

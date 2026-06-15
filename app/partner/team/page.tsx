import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerMentors, type PartnerMentor } from '@/lib/partners/mentorRoster'
import { getPartnerCandidates, type PartnerCandidate } from '@/lib/partners/candidateProgress'
import { availableDisciplineNames } from '@/lib/disciplines-data'
import { MentorForm } from './_mentor-form'
import { MentorsPanel } from './_mentors-panel'

export const dynamic = 'force-dynamic'

export default async function PartnerTeamPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/team')
  }

  let mentors: PartnerMentor[] = []
  let roster: PartnerCandidate[] = []
  let loadError = false
  try {
    // requirePartner guarantees a non-null partnerId.
    mentors = await getPartnerMentors(ctx.partnerId!)
    roster = await getPartnerCandidates(ctx.partnerId!)
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Team</p>
        <h1 className="text-2xl font-bold text-navy">Your mentors</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mentors.length > 0
            ? `${mentors.length} mentor${mentors.length === 1 ? '' : 's'} in your organisation`
            : 'Add a mentor, then grant disciplines and assign candidates.'}
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your team right now. Please refresh — if this keeps happening, contact support.
        </div>
      ) : mentors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-slate-900">No mentors yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add your first mentor below — they must already have a Career Bridge account.
          </p>
        </div>
      ) : (
        <MentorsPanel
          mentors={mentors}
          roster={roster.map((r) => ({ userId: r.userId, fullName: r.fullName, email: r.email }))}
          availableDisciplines={availableDisciplineNames}
        />
      )}

      <MentorForm />
    </div>
  )
}

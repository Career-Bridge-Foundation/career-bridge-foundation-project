import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerMentors, type PartnerMentor } from '@/lib/partners/mentorRoster'
import { getPartnerCandidates, type PartnerCandidate } from '@/lib/partners/candidateProgress'
import { getPartnerInvites, type PartnerInvite } from '@/lib/partners/inviteRoster'
import { availableDisciplineNames } from '@/lib/disciplines-data'
import { TeamTabs } from './_team-tabs'

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
  let invites: PartnerInvite[] = []
  let loadError = false
  try {
    // requirePartner guarantees a non-null partnerId.
    mentors = await getPartnerMentors(ctx.partnerId!)
    roster = await getPartnerCandidates(ctx.partnerId!)
    invites = await getPartnerInvites(ctx.partnerId!)
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Team</p>
        <h1 className="text-2xl font-bold text-navy">Your team</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage mentors and sub-admins for your organisation.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your team right now. Please refresh — if this keeps happening, contact support.
        </div>
      ) : (
        <TeamTabs
          mentors={mentors}
          roster={roster.map((r) => ({ userId: r.userId, fullName: r.fullName, email: r.email }))}
          availableDisciplines={availableDisciplineNames}
          invites={invites}
        />
      )}
    </div>
  )
}

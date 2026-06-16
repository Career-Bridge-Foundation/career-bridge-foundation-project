'use client'
import { useState } from 'react'
import type { PartnerMentor } from '@/lib/partners/mentorRoster'
import type { PartnerInvite } from '@/lib/partners/inviteRoster'
import { MentorsPanel } from './_mentors-panel'
import { MentorForm } from './_mentor-form'
import { InvitesPanel } from './_invites-panel'
import { InviteForm } from './_invite-form'

type RosterOption = { userId: string; fullName: string | null; email: string | null }
type Tab = 'mentors' | 'subadmins'

export function TeamTabs({
  mentors,
  roster,
  availableDisciplines,
  invites,
}: {
  mentors: PartnerMentor[]
  roster: RosterOption[]
  availableDisciplines: string[]
  invites: PartnerInvite[]
}) {
  const [tab, setTab] = useState<Tab>('mentors')

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
      tab === t
        ? 'border-navy text-navy'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setTab('mentors')} className={tabCls('mentors')}>
          Mentors{mentors.length ? ` (${mentors.length})` : ''}
        </button>
        <button type="button" onClick={() => setTab('subadmins')} className={tabCls('subadmins')}>
          Sub-admins{invites.length ? ` (${invites.length})` : ''}
        </button>
      </div>

      {tab === 'mentors' ? (
        <div className="space-y-8">
          {mentors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-base font-semibold text-slate-900">No mentors yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Add your first mentor below — they must already have a Career Bridge account.
              </p>
            </div>
          ) : (
            <MentorsPanel
              mentors={mentors}
              roster={roster}
              availableDisciplines={availableDisciplines}
            />
          )}
          <MentorForm />
        </div>
      ) : (
        <div className="space-y-8">
          {invites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-base font-semibold text-slate-900">No sub-admins yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Invite a colleague by email to co-manage your organisation.
              </p>
            </div>
          ) : (
            <InvitesPanel invites={invites} />
          )}
          <InviteForm />
        </div>
      )}
    </div>
  )
}

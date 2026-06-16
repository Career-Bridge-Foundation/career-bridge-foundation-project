'use client'
import type { PartnerInvite, PartnerInviteStatus } from '@/lib/partners/inviteRoster'

const PILL: Record<PartnerInviteStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-slate-100 text-slate-500',
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function InvitesPanel({ invites }: { invites: PartnerInvite[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Invited</th>
            <th className="px-4 py-3 font-medium">Expires</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invites.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-3 text-slate-800">{inv.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PILL[inv.status]}`}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">{fmt(inv.createdAt)}</td>
              <td className="px-4 py-3 text-slate-500">
                {inv.status === 'accepted' ? `Accepted ${fmt(inv.acceptedAt)}` : fmt(inv.expiresAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

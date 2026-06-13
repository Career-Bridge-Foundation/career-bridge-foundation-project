import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerUsage, type PartnerUsage } from '@/lib/partners/usage'

export const dynamic = 'force-dynamic'

export default async function PartnerUsagePage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/usage')
  }

  let usage: PartnerUsage | null = null
  let loadError = false
  try {
    usage = await getPartnerUsage(ctx.partnerId!)
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Usage</p>
        <h1 className="text-2xl font-bold text-navy">Seat usage</h1>
        <p className="mt-1 text-sm text-slate-600">
          A seat is one unique candidate — counted once, regardless of how many disciplines they take.
        </p>
      </header>

      {loadError || !usage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your usage right now. Please refresh.
        </div>
      ) : usage.seatsConsumed === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No seats used yet — provision a candidate to get started.
        </div>
      ) : (
        <UsageCard usage={usage} />
      )}
    </div>
  )
}

function UsageCard({ usage }: { usage: PartnerUsage }) {
  const { seatsConsumed, seatsCommitted, seatsRemaining } = usage
  const hasCommitment = seatsCommitted !== null
  const over = hasCommitment && (seatsRemaining ?? 0) < 0
  const pct =
    hasCommitment && seatsCommitted! > 0 ? Math.min(100, Math.round((seatsConsumed / seatsCommitted!) * 100)) : 0
  return (
    <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold text-navy">{seatsConsumed}</span>
        <span className="text-sm text-slate-500">{hasCommitment ? `of ${seatsCommitted} seats` : 'seats used'}</span>
      </div>
      {hasCommitment ? (
        <>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-teal'}`} style={{ width: `${over ? 100 : pct}%` }} />
          </div>
          <p className={`mt-2 text-sm ${over ? 'text-red-600' : 'text-slate-600'}`}>
            {over
              ? `Over commitment by ${Math.abs(seatsRemaining!)} seat${Math.abs(seatsRemaining!) === 1 ? '' : 's'}`
              : `${seatsRemaining} remaining`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No volume commitment set.</p>
      )}
      <p className="mt-4 text-xs text-slate-400">
        {seatsConsumed} unique candidate{seatsConsumed === 1 ? '' : 's'}.
      </p>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getPartnerCandidateProgress } from '@/lib/partners/candidateProgress'
import { computePartnerAnalytics, type PartnerAnalytics } from '@/lib/partners/analytics'
import { AnalyticsView } from './_analytics-view'

export const dynamic = 'force-dynamic'

export default async function PartnerAnalyticsPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/analytics')
  }

  let analytics: PartnerAnalytics | null = null
  let loadError = false
  try {
    const candidates = await getPartnerCandidateProgress(ctx.partnerId!)
    analytics = computePartnerAnalytics(candidates)
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Analytics</p>
        <h1 className="text-2xl font-bold text-navy">Cohort analytics</h1>
        <p className="mt-1 text-sm text-slate-600">How your provisioned candidates are progressing and performing.</p>
      </header>

      {loadError || !analytics ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          We couldn’t load your analytics right now. Please refresh.
        </div>
      ) : analytics.funnel.provisioned === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No candidates provisioned yet — once you provision candidates, their progress will appear here.
        </div>
      ) : (
        <AnalyticsView analytics={analytics} />
      )}
    </div>
  )
}

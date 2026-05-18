import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  FileText,
  CheckCircle2,
  Edit3,
  Clock,
  Users,
  BarChart2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Globe,
  Award,
} from 'lucide-react'
import { getCurrentUserRole } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Foundation:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Practitioner: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Advanced:     { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}
const FALLBACK_DIFFICULTY = { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  draft:          { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Draft' },
  pending_review: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Pending Review' },
  published:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Published' },
  archived:       { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Archived' },
}

const CERT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  certified: { bg: '#f0fdf4', color: '#16a34a', label: 'Certified' },
  rejected:  { bg: '#fff1f2', color: '#e11d48', label: 'Rejected' },
  pending:   { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:       'Super Admin',
  admin:             'Admin',
  content_developer: 'Content Dev',
  reviewer:          'Reviewer',
  candidate:         'Candidate',
}

type Sim = {
  slug: string
  title?: string | null
  difficulty?: string | null
  industry?: string | null
  status: string
  cert_status?: string | null
  certified_by?: string | null
  certified_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

function StatCard({
  label, value, icon: Icon, stripe, iconBg, sub,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  stripe: string
  iconBg: string
  sub?: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #17233753',
        borderLeft: `3px solid ${stripe}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(0,51,89,0.45)' }}>
            {label}
          </div>
          <div className="text-3xl font-bold" style={{ color: '#003359' }}>{value}</div>
          {sub && <div className="text-xs mt-1" style={{ color: 'rgba(0,51,89,0.4)' }}>{sub}</div>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon size={17} style={{ color: '#003259e4' }} />
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, action }: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  action?: { href: string; label: string }
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #d5dce8' }}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} style={{ color: '#0d9488' }} />}
          <span className="font-semibold text-sm" style={{ color: '#003359' }}>{title}</span>
        </div>
        {action && (
          <Link href={action.href} className="text-xs font-medium" style={{ color: '#4dc5d2' }}>
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

export default async function AdminPage() {
  const ctx = await getCurrentUserRole()
  if (!ctx || !['admin', 'super_admin', 'content_developer'].includes(ctx.role)) {
    redirect('/auth/login')
  }
  if (ctx.role === 'content_developer') {
    redirect('/admin/simulations')
  }

  const isSuperAdmin = ctx.role === 'super_admin'

  // ── Core simulation data ────────────────────────────────────────────────────
  const { data: simsRaw } = await supabaseServer
    .from('simulations')
    .select('slug, title, difficulty, industry, status, cert_status, certified_by, certified_at, updated_at, created_at')
    .order('updated_at', { ascending: false })

  const sims: Sim[] = simsRaw ?? []
  const total = sims.length

  const byStatus = sims.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const byDifficulty = sims.reduce<Record<string, number>>((acc, s) => {
    const key = s.difficulty ?? 'Unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const recent = sims.slice(0, 8)
  const pendingReview = sims.filter(s => s.status === 'pending_review')

  // ── Super admin: additional queries ─────────────────────────────────────────
  let byRole: Record<string, number> = {}
  let recentCerts: Sim[] = []
  let topIndustries: [string, number][] = []
  let reviewerLeaderboard: {
    id: string; email: string; comments: number; certified: number; rejected: number
  }[] = []
  let stalePending: Sim[] = []
  let certifiedCount = 0
  let rejectedCount = 0
  let certPendingCount = 0
  let publishedLast30 = 0
  let contentDevCount = 0

  if (isSuperAdmin) {
    // ── User roles ──
    const { data: roleRows } = await supabaseServer
      .from('user_roles')
      .select('user_id, email, role')

    byRole = (roleRows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1
      return acc
    }, {})

    contentDevCount = byRole.content_developer ?? 0

    const reviewerEmailMap: Record<string, string> = {}
    for (const r of roleRows ?? []) {
      if (r.email) reviewerEmailMap[r.user_id] = r.email
    }

    // ── Recent cert decisions ──
    recentCerts = sims
      .filter(s => s.cert_status && s.cert_status !== 'pending' && s.certified_at)
      .sort((a, b) => new Date(b.certified_at!).getTime() - new Date(a.certified_at!).getTime())
      .slice(0, 6)

    // ── Cert health metrics ──
    certifiedCount = sims.filter(s => s.cert_status === 'certified').length
    rejectedCount  = sims.filter(s => s.cert_status === 'rejected').length
    certPendingCount = sims.filter(s => (s.cert_status ?? 'pending') === 'pending').length

    // ── Published in last 30 days ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    publishedLast30 = sims.filter(
      s => s.status === 'published' && s.updated_at && s.updated_at >= thirtyDaysAgo
    ).length

    // ── Industry coverage ──
    const byIndustry = sims.reduce<Record<string, number>>((acc, s) => {
      const key = s.industry?.trim() || 'Uncategorized'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    topIndustries = Object.entries(byIndustry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    // ── Stale pending (> 7 days) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    stalePending = sims
      .filter(s => s.status === 'pending_review' && s.updated_at && s.updated_at < sevenDaysAgo)
      .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime())

    // ── Reviewer leaderboard ──
    // Count certs by reviewer (from certified_by field on simulations)
    const certsByReviewer: Record<string, { certified: number; rejected: number }> = {}
    for (const s of sims) {
      if (!s.certified_by) continue
      if (!certsByReviewer[s.certified_by]) certsByReviewer[s.certified_by] = { certified: 0, rejected: 0 }
      if (s.cert_status === 'certified') certsByReviewer[s.certified_by].certified++
      else if (s.cert_status === 'rejected') certsByReviewer[s.certified_by].rejected++
    }

    // Count comments per reviewer
    const { data: commentRows } = await supabaseServer
      .from('simulation_comments')
      .select('reviewer_id')

    const commentsByReviewer: Record<string, number> = {}
    for (const c of commentRows ?? []) {
      commentsByReviewer[c.reviewer_id] = (commentsByReviewer[c.reviewer_id] ?? 0) + 1
    }

    const allReviewerIds = [...new Set([
      ...Object.keys(certsByReviewer),
      ...Object.keys(commentsByReviewer),
    ])]

    reviewerLeaderboard = allReviewerIds
      .map(id => ({
        id,
        email: reviewerEmailMap[id] ?? 'Unknown',
        comments:   commentsByReviewer[id] ?? 0,
        certified:  certsByReviewer[id]?.certified ?? 0,
        rejected:   certsByReviewer[id]?.rejected ?? 0,
      }))
      .sort((a, b) => (b.comments + b.certified * 2) - (a.comments + a.certified * 2))
      .slice(0, 10)
  }

  const totalCertReviewed = certifiedCount + rejectedCount
  const certApprovalRate = totalCertReviewed > 0 ? Math.round((certifiedCount / totalCertReviewed) * 100) : 0

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = [
    {
      label: 'Total Simulations',
      value: total,
      icon: FileText,
      stripe: '#003259e4',
      iconBg: 'rgba(58,152,162,0.1)',
    },
    {
      label: 'Published',
      value: byStatus.published ?? 0,
      icon: CheckCircle2,
      stripe: '#16a34a',
      iconBg: '#f0fdf4',
      sub: isSuperAdmin && publishedLast30 > 0 ? `+${publishedLast30} this month` : undefined,
    },
    {
      label: 'Pending Review',
      value: byStatus.pending_review ?? 0,
      icon: Clock,
      stripe: '#1d4ed8',
      iconBg: '#eff6ff',
      sub: isSuperAdmin && stalePending.length > 0 ? `${stalePending.length} overdue (7d+)` : undefined,
    },
    {
      label: 'Drafts',
      value: byStatus.draft ?? 0,
      icon: Edit3,
      stripe: '#6b7280',
      iconBg: '#f8fafc',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-bold text-2xl tracking-tight" style={{ color: '#003359' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(0,51,89,0.45)' }}>
          {isSuperAdmin ? 'Platform overview & analytics' : 'Overview of your simulation library'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-5">
        {statCards.map(card => <StatCard key={card.label} {...card} />)}
      </div>

      {/* Status breakdown bar */}
      {total > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(0,51,89,0.45)' }}>
            Simulations by status
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
            {Object.entries(STATUS_STYLE).map(([status, style]) => {
              const count = byStatus[status] ?? 0
              if (count === 0) return null
              const pct = Math.round((count / total) * 100)
              return (
                <div
                  key={status}
                  style={{ width: `${pct}%`, backgroundColor: style.color, opacity: 0.8 }}
                  title={`${style.label}: ${count}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-5">
            {Object.entries(STATUS_STYLE).map(([status, style]) => {
              const count = byStatus[status] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                  <span style={{ color: 'rgba(0,51,89,0.6)' }}>{style.label}</span>
                  <span className="font-semibold" style={{ color: '#003359' }}>{count}</span>
                  <span style={{ color: 'rgba(0,51,89,0.35)' }}>({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stale pending alert (super admin) */}
      {isSuperAdmin && stalePending.length > 0 && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a' }}
        >
          <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#92400e' }}>
              {stalePending.length} simulation{stalePending.length !== 1 ? 's' : ''} waiting for approval over 7 days
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {stalePending.map(s => (
                <Link
                  key={s.slug}
                  href={`/admin/simulations/${s.slug}`}
                  className="text-xs px-2 py-0.5 rounded border font-medium hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}
                >
                  {s.title ?? s.slug}
                  <span className="ml-1.5 opacity-60">
                    {formatDistanceToNow(new Date(s.updated_at!), { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending review queue */}
      {pendingReview.length > 0 && (
        <SectionCard
          title={`Awaiting Approval (${pendingReview.length})`}
          icon={Clock}
          action={{ href: '/admin/simulations', label: 'View all' }}
        >
          <div>
            {pendingReview.slice(0, 6).map(sim => (
              <Link
                key={sim.slug}
                href={`/admin/simulations/${sim.slug}`}
                className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[#f5f7fb] group"
                style={{ borderBottom: '1px solid #f3f4f6' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#eff6ff' }}>
                  <FileText size={14} style={{ color: '#1d4ed8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>{sim.title ?? sim.slug}</div>
                  {sim.industry && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.4)' }}>{sim.industry}</div>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: 'rgba(0,51,89,0.3)' }}>
                  {formatDistanceToNow(new Date(sim.updated_at ?? new Date()), { addSuffix: true })}
                </span>
                <ExternalLink size={12} style={{ color: 'rgba(0,51,89,0.2)' }} />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Super Admin analytics ──────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <>
          {/* Row: Certification health + Team composition */}
          <div className="grid grid-cols-2 gap-5">
            {/* Certification health */}
            <SectionCard title="Certification Health" icon={ShieldCheck}>
              <div className="px-6 py-5">
                {/* Approval rate gauge */}
                <div className="flex items-end gap-4 mb-5">
                  <div>
                    <div className="text-4xl font-bold" style={{ color: '#003359' }}>{certApprovalRate}%</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.5)' }}>approval rate</div>
                  </div>
                  {totalCertReviewed > 0 && (
                    <div className="flex-1 pb-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0fdf4' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${certApprovalRate}%`, backgroundColor: '#16a34a' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Certified',  count: certifiedCount,  color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Rejected',   count: rejectedCount,   color: '#e11d48', bg: '#fff1f2' },
                    { label: 'Unreviewed', count: certPendingCount, color: '#d97706', bg: '#fffbeb' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: bg }}>
                      <div className="text-xl font-bold" style={{ color }}>{count}</div>
                      <div className="text-xs mt-0.5" style={{ color }}>{label}</div>
                    </div>
                  ))}
                </div>

                {totalCertReviewed === 0 && (
                  <p className="text-xs text-center py-2 mt-2" style={{ color: 'rgba(0,51,89,0.4)' }}>
                    No simulations have been reviewed yet
                  </p>
                )}
              </div>
            </SectionCard>

            {/* Team composition */}
            <SectionCard title="Team Composition" icon={Users} action={{ href: '/admin/team', label: 'Manage' }}>
              <div className="px-6 py-5 space-y-4">
                {Object.entries(byRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                  const totalUsers = Object.values(byRole).reduce((a, b) => a + b, 0)
                  const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
                  return (
                    <div key={role}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium" style={{ color: 'rgba(0,51,89,0.7)' }}>
                          {ROLE_LABELS[role] ?? role}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: '#003359' }}>
                          {count}
                          <span className="font-normal text-xs ml-1" style={{ color: 'rgba(0,51,89,0.4)' }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#0d9488' }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(byRole).length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>No team members yet</p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Row: Industry coverage + Difficulty breakdown */}
          <div className="grid grid-cols-2 gap-5">
            {/* Industry coverage */}
            <SectionCard title="Industry Coverage" icon={Globe}>
              <div className="px-6 py-5 space-y-3">
                {topIndustries.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>No industry data</p>
                ) : (
                  topIndustries.map(([industry, count]) => {
                    const maxCount = topIndustries[0][1]
                    const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
                    return (
                      <div key={industry}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs truncate max-w-[70%]" style={{ color: 'rgba(0,51,89,0.7)' }}>{industry}</span>
                          <span className="text-xs font-semibold" style={{ color: '#003359' }}>{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#4dc5d2' }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </SectionCard>

            {/* Difficulty breakdown */}
            <SectionCard title="By Difficulty" icon={BarChart2}>
              <div className="px-6 py-5 space-y-4">
                {Object.entries(byDifficulty).map(([k, v]) => {
                  const pct = total > 0 ? Math.round((v / total) * 100) : 0
                  const ds = DIFFICULTY_STYLE[k] ?? FALLBACK_DIFFICULTY
                  return (
                    <div key={k}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}
                        >
                          {k}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: '#003359' }}>
                          {v}
                          <span className="font-normal text-xs ml-1" style={{ color: 'rgba(0,51,89,0.4)' }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ds.color }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(byDifficulty).length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>No simulations yet</p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Reviewer leaderboard */}
          {reviewerLeaderboard.length > 0 && (
            <SectionCard title="Reviewer Leaderboard" icon={Award} action={{ href: '/admin/team', label: 'Manage team' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Reviewer', 'Comments', 'Certified', 'Rejected', 'Total Actions'].map(h => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'rgba(0,51,89,0.45)', backgroundColor: '#f8fafc' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewerLeaderboard.map((r, idx) => {
                      const totalActions = r.comments + r.certified + r.rejected
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{
                                  backgroundColor: idx === 0 ? '#fef9c3' : idx === 1 ? '#f1f5f9' : '#f8fafc',
                                  color: idx === 0 ? '#a16207' : '#475569',
                                }}
                              >
                                {idx + 1}
                              </div>
                              <span className="font-medium truncate max-w-[180px]" style={{ color: '#003359' }}>
                                {r.email}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare size={12} style={{ color: '#6b7280' }} />
                              <span className="font-semibold" style={{ color: '#003359' }}>{r.comments}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                            >
                              {r.certified}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}
                            >
                              {r.rejected}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold" style={{ color: '#003359' }}>{totalActions}</span>
                              <div className="flex-1 max-w-[80px]">
                                <div className="h-1 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, Math.round((totalActions / (reviewerLeaderboard[0] ? reviewerLeaderboard[0].comments + reviewerLeaderboard[0].certified + reviewerLeaderboard[0].rejected : 1)) * 100))}%`,
                                      backgroundColor: '#0d9488',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Recent reviewer activity + Recently edited */}
          <div className="grid grid-cols-2 gap-5">
            {recentCerts.length > 0 && (
              <SectionCard title="Recent Cert Decisions" icon={ShieldCheck}>
                <div>
                  {recentCerts.map(sim => {
                    const cert = sim.cert_status ?? 'pending'
                    const cs = CERT_STYLE[cert] ?? CERT_STYLE.pending
                    return (
                      <Link
                        key={sim.slug}
                        href={`/admin/simulations/${sim.slug}/reviews`}
                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#f5f7fb] transition-colors"
                        style={{ borderBottom: '1px solid #f3f4f6' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>
                            {sim.title ?? sim.slug}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.4)' }}>
                            {sim.certified_at ? formatDistanceToNow(new Date(sim.certified_at), { addSuffix: true }) : ''}
                          </div>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium border shrink-0"
                          style={{ backgroundColor: cs.bg, color: cs.color, borderColor: cs.color + '40' }}
                        >
                          {cs.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Recently Edited"
              icon={TrendingUp}
              action={{ href: '/admin/simulations', label: 'View all' }}
            >
              <div>
                {recent.slice(0, 6).map(sim => {
                  const diff = sim.difficulty ?? 'Unknown'
                  const ds = DIFFICULTY_STYLE[diff] ?? FALLBACK_DIFFICULTY
                  return (
                    <Link
                      key={sim.slug}
                      href={`/admin/simulations/${sim.slug}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#f5f7fb] transition-colors"
                      style={{ borderBottom: '1px solid #f3f4f6' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>{sim.title ?? sim.slug}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.4)' }}>
                          {formatDistanceToNow(new Date(sim.updated_at ?? new Date()), { addSuffix: true })}
                        </div>
                      </div>
                      {sim.difficulty && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}
                        >
                          {sim.difficulty}
                        </span>
                      )}
                      <ExternalLink size={12} style={{ color: 'rgba(0,51,89,0.2)' }} />
                    </Link>
                  )
                })}
              </div>
            </SectionCard>
          </div>
        </>
      )}

      {/* ── Admin (non-super) dashboard ────────────────────────────────────────── */}
      {!isSuperAdmin && (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 320px' }}>
          {/* Recently edited */}
          <SectionCard title="Recently Edited" action={{ href: '/admin/simulations', label: 'View all' }}>
            <div>
              {recent.map(sim => {
                const diff = sim.difficulty ?? 'Unknown'
                const ds = DIFFICULTY_STYLE[diff] ?? FALLBACK_DIFFICULTY
                return (
                  <Link
                    key={sim.slug}
                    href={`/admin/simulations/${sim.slug}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#f5f7fb] transition-colors"
                    style={{ borderBottom: '1px solid #f3f4f6' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,51,89,0.05)' }}>
                      <FileText size={14} style={{ color: 'rgba(0,51,89,0.35)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>{sim.title ?? sim.slug}</div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(0,51,89,0.4)' }}>{sim.slug}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sim.difficulty && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}
                        >
                          {sim.difficulty}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'rgba(0,51,89,0.3)' }}>
                        {formatDistanceToNow(new Date(sim.updated_at ?? new Date()), { addSuffix: true })}
                      </span>
                      <ExternalLink size={12} style={{ color: 'rgba(0,51,89,0.2)' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </SectionCard>

          {/* Difficulty breakdown */}
          <SectionCard title="By Difficulty" icon={BarChart2}>
            <div className="px-6 py-5 space-y-5">
              {Object.entries(byDifficulty).map(([k, v]) => {
                const pct = total > 0 ? Math.round((v / total) * 100) : 0
                const ds = DIFFICULTY_STYLE[k] ?? FALLBACK_DIFFICULTY
                return (
                  <div key={k}>
                    <div className="flex justify-between items-center mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}
                      >
                        {k}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: '#003359' }}>
                        {v}
                        <span className="font-normal text-xs ml-1" style={{ color: 'rgba(0,51,89,0.4)' }}>({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ds.color }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(byDifficulty).length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>No simulations yet</p>
              )}
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid #d5dce8', backgroundColor: '#f9fafb' }}>
              <div className="flex justify-between text-xs" style={{ color: 'rgba(0,51,89,0.5)' }}>
                <span>Total simulations</span>
                <span className="font-semibold" style={{ color: '#003359' }}>{total}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

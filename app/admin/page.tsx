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
  Plus,
  BookOpen,
  SendHorizonal,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { getCurrentUserRole } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { ImportButton } from './_import-button'

export const dynamic = 'force-dynamic'

// ── Style maps ────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Foundation:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Practitioner: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Advanced:     { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}
const FALLBACK_DIFFICULTY = { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string; chart: string }> = {
  draft:          { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', label: 'Draft',          chart: '#94a3b8' },
  pending_review: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Pending Review', chart: '#4DC5D2' },
  published:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Published',      chart: '#16a34a' },
  archived:       { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Archived',       chart: '#f59e0b' },
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

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({
  segments,
  total,
  subtitle,
  size = 140,
}: {
  segments: { label: string; pct: number; color: string }[]
  total: number
  subtitle: string
  size?: number
}) {
  const cx = 50, cy = 50, r = 36
  const circumference = 2 * Math.PI * r
  const strokeWidth = 11
  let cumulativeAngle = -90

  const nonZero = segments.filter(s => s.pct > 0)

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e4eaf3" strokeWidth={strokeWidth} />

      {nonZero.length === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e4eaf3" strokeWidth={strokeWidth} />
      ) : (
        nonZero.map((seg, i) => {
          const dashLength = (seg.pct / 100) * circumference
          const startAngle = cumulativeAngle
          cumulativeAngle += (seg.pct / 100) * 360
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={0}
              strokeLinecap="butt"
              transform={`rotate(${startAngle} ${cx} ${cy})`}
            />
          )
        })
      )}

      {/* Center */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="700"
        fill="#003359"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {total}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="7"
        fill="#003359"
        opacity="0.42"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {subtitle}
      </text>
    </svg>
  )
}

// ── SVG Mini Bar Chart ────────────────────────────────────────────────────────

function MiniBarChart({
  data,
}: {
  data: { label: string; value: number; color: string }[]
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barH = 10
  const gap = 18
  const totalH = data.length * (barH + gap) - gap + 4
  const trackW = 180

  return (
    <svg viewBox={`0 0 220 ${totalH}`} className="w-full" style={{ maxHeight: `${totalH + 8}px` }}>
      {data.map((d, i) => {
        const y = i * (barH + gap)
        const barW = Math.max((d.value / max) * trackW, d.value > 0 ? 4 : 0)
        return (
          <g key={d.label}>
            {/* Label */}
            <text x={0} y={y + barH - 1} fontSize="7.5" fill="#003359" opacity="0.55" fontFamily="Inter, system-ui, sans-serif">
              {d.label}
            </text>
            {/* Track */}
            <rect x={0} y={y + barH + 3} width={trackW} height={barH} rx={5} fill="#e4eaf3" />
            {/* Bar */}
            {d.value > 0 && (
              <rect x={0} y={y + barH + 3} width={barW} height={barH} rx={5} fill={d.color} />
            )}
            {/* Count */}
            <text x={trackW + 6} y={y + barH + 10} fontSize="8" fontWeight="600" fill="#003359" fontFamily="Inter, system-ui, sans-serif">
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Hero card (dark navy featured card) ──────────────────────────────────────

function HeroCard({
  total,
  published,
  drafts,
  pendingCount,
}: {
  total: number
  published: number
  drafts: number
  pendingCount: number
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative"
      style={{
        background: 'linear-gradient(140deg, #003359 0%, #00527a 100%)',
        minHeight: '168px',
      }}
    >
      {/* subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(77,197,210,0.2)', color: '#4DC5D2', letterSpacing: '0.08em' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4DC5D2' }} />
          Live
        </div>
        {pendingCount > 0 && (
          <div
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(253,224,71,0.15)', color: '#fde047' }}
          >
            {pendingCount} awaiting review
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <div
          className="text-xs font-semibold uppercase mb-1"
          style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em' }}
        >
          Simulation Library
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-4xl font-bold leading-none"
            style={{ color: '#4DC5D2', letterSpacing: '-0.02em' }}
          >
            {published}
          </span>
          <span className="text-white/60 text-sm font-medium">published live</span>
        </div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {total} total · {drafts} in draft
        </div>
      </div>

      <Link
        href="/admin/simulations"
        className="relative inline-flex items-center gap-1 text-xs font-semibold mt-5 transition-opacity hover:opacity-80"
        style={{ color: '#4DC5D2' }}
      >
        See all simulations
        <ArrowUpRight size={12} />
      </Link>
    </div>
  )
}

// ── Modern stat card ──────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accentColor, iconBg, sub, href,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  accentColor: string
  iconBg: string
  sub?: string
  href?: string
}) {
  const inner = (
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'rgba(0,51,89,0.45)', letterSpacing: '0.1em' }}
        >
          {label}
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={16} style={{ color: accentColor }} />
        </div>
      </div>

      <div
        className="text-[2rem] font-bold leading-none mb-2"
        style={{ color: '#003359', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>

      {sub && (
        <div className="text-xs" style={{ color: 'rgba(0,51,89,0.42)' }}>
          {sub}
        </div>
      )}
    </div>
  )

  const cardBase = {
    backgroundColor: '#ffffff',
    border: '1px solid #e4eaf3',
    boxShadow: '0 1px 4px rgba(0,51,89,0.05)',
    borderTop: `3px solid ${accentColor}`,
  }

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl block transition-all hover:-translate-y-0.5 hover:shadow-lg"
        style={cardBase}
      >
        {inner}
      </Link>
    )
  }
  return <div className="rounded-2xl" style={cardBase}>{inner}</div>
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
  noPad,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  action?: { href: string; label: string }
  noPad?: boolean
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e4eaf3',
        boxShadow: '0 1px 4px rgba(0,51,89,0.05)',
      }}
    >
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #eef2f7' }}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} style={{ color: '#4DC5D2' }} />}
          <span className="font-semibold text-sm" style={{ color: '#003359' }}>
            {title}
          </span>
        </div>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: '#006FAD' }}
          >
            {action.label}
            <ArrowUpRight size={11} />
          </Link>
        )}
      </div>
      {noPad ? children : <div>{children}</div>}
    </div>
  )
}

// ── Sim row item ──────────────────────────────────────────────────────────────

function SimRow({
  sim,
  href,
  showCert,
}: {
  sim: Sim
  href: string
  showCert?: boolean
}) {
  const diff = sim.difficulty ?? 'Unknown'
  const ds = DIFFICULTY_STYLE[diff] ?? FALLBACK_DIFFICULTY
  const ss = STATUS_STYLE[sim.status] ?? STATUS_STYLE.draft

  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-6 py-3.5 transition-colors group hover:bg-[#f8fafd]"
      style={{ borderBottom: '1px solid #f0f4f8' }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: ss.bg }}
      >
        <FileText size={14} style={{ color: ss.color }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>
          {sim.title ?? sim.slug}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.4)' }}>
          {sim.industry ?? sim.slug} ·{' '}
          {formatDistanceToNow(new Date(sim.updated_at ?? new Date()), { addSuffix: true })}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {sim.difficulty && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}
          >
            {sim.difficulty}
          </span>
        )}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
        >
          {ss.label}
        </span>
        {showCert && sim.cert_status && (() => {
          const cs = CERT_STYLE[sim.cert_status] ?? CERT_STYLE.pending
          return (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: cs.bg, color: cs.color }}
            >
              {cs.label}
            </span>
          )
        })()}
      </div>

      <ExternalLink size={11} style={{ color: 'rgba(0,51,89,0.18)' }} className="shrink-0" />
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const ctx = await getCurrentUserRole()
  if (!ctx || !['admin', 'super_admin', 'content_developer'].includes(ctx.role)) {
    redirect('/auth/login')
  }
  const isContentDev = ctx.role === 'content_developer'
  const showFullAnalytics = ctx.role === 'super_admin' || ctx.role === 'admin'

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
  const publishedCount = byStatus.published ?? 0
  const draftCount = byStatus.draft ?? 0

  // Donut chart segments
  const statusSegments = Object.entries(STATUS_STYLE)
    .map(([key, style]) => ({
      label: style.label,
      pct: total > 0 ? ((byStatus[key] ?? 0) / total) * 100 : 0,
      color: style.chart,
      count: byStatus[key] ?? 0,
    }))
    .filter(s => s.count > 0)

  // ── Content developer dashboard ─────────────────────────────────────────────
  if (isContentDev) {
    const pendingCount = byStatus.pending_review ?? 0

    return (
      <div className="space-y-6 max-w-5xl">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl tracking-tight" style={{ color: '#003359', letterSpacing: '-0.01em' }}>
              Content Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(0,51,89,0.45)' }}>
              Manage and edit simulation content
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton />
            <Link
              href="/admin/simulations/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#003359', color: '#ffff' }}
            >
              <Plus size={14} />
              New Simulation
            </Link>
          </div>
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroCard
            total={total}
            published={publishedCount}
            drafts={draftCount}
            pendingCount={pendingCount}
          />
          <StatCard label="Drafts"         value={draftCount}   icon={Edit3}         accentColor="#94a3b8" iconBg="#f1f5f9" href="/admin/simulations?status=draft" />
          <StatCard label="Pending Review" value={pendingCount} icon={SendHorizonal}  accentColor="#006FAD" iconBg="#eff6ff" href="/admin/simulations?status=pending_review" />
          <StatCard label="Published"      value={publishedCount} icon={CheckCircle2} accentColor="#16a34a" iconBg="#f0fdf4" href="/admin/simulations?status=published" />
        </div>

        {/* Status breakdown */}
        {total > 0 && (
          <SectionCard title="Status Distribution" icon={BarChart2} noPad>
            <div className="p-6 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <DonutChart segments={statusSegments} total={total} subtitle="total" size={140} />
              <div className="flex-1 space-y-3">
                {statusSegments.map(seg => (
                  <div key={seg.label} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-sm flex-1" style={{ color: 'rgba(0,51,89,0.65)' }}>
                      {seg.label}
                    </span>
                    <span className="font-semibold text-sm" style={{ color: '#003359' }}>
                      {seg.count}
                    </span>
                    <span className="text-xs w-9 text-right" style={{ color: 'rgba(0,51,89,0.35)' }}>
                      {Math.round(seg.pct)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Pending review queue */}
        {pendingReview.length > 0 && (
          <SectionCard
            title={`Awaiting Review (${pendingReview.length})`}
            icon={Clock}
            action={{ href: '/admin/simulations?status=pending_review', label: 'View all' }}
            noPad
          >
            <div>
              {pendingReview.slice(0, 5).map(sim => (
                <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}`} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Recently edited */}
        <SectionCard
          title="Recently Edited"
          icon={TrendingUp}
          action={{ href: '/admin/simulations', label: 'View all' }}
          noPad
        >
          <div>
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm" style={{ color: 'rgba(0,51,89,0.4)' }}>No simulations yet</p>
                <Link
                  href="/admin/simulations/new"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold"
                  style={{ color: '#006FAD' }}
                >
                  <Plus size={12} /> Create your first simulation
                </Link>
              </div>
            ) : (
              recent.map(sim => (
                <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}/content`} />
              ))
            )}
          </div>
        </SectionCard>
      </div>
    )
  }

  // ── Admin / Super admin: additional queries ─────────────────────────────────
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

  if (showFullAnalytics) {
    const { data: roleRows } = await supabaseServer
      .from('user_roles')
      .select('user_id, email, role')

    byRole = (roleRows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1
      return acc
    }, {})

    const reviewerEmailMap: Record<string, string> = {}
    for (const r of roleRows ?? []) {
      if (r.email) reviewerEmailMap[r.user_id] = r.email
    }

    recentCerts = sims
      .filter(s => s.cert_status && s.cert_status !== 'pending' && s.certified_at)
      .sort((a, b) => new Date(b.certified_at!).getTime() - new Date(a.certified_at!).getTime())
      .slice(0, 6)

    certifiedCount    = sims.filter(s => s.cert_status === 'certified').length
    rejectedCount     = sims.filter(s => s.cert_status === 'rejected').length
    certPendingCount  = sims.filter(s => (s.cert_status ?? 'pending') === 'pending').length

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    publishedLast30 = sims.filter(
      s => s.status === 'published' && s.updated_at && s.updated_at >= thirtyDaysAgo
    ).length

    const byIndustry = sims.reduce<Record<string, number>>((acc, s) => {
      const key = s.industry?.trim() || 'Uncategorized'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    topIndustries = Object.entries(byIndustry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    stalePending = sims
      .filter(s => s.status === 'pending_review' && s.updated_at && s.updated_at < sevenDaysAgo)
      .sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime())

    const certsByReviewer: Record<string, { certified: number; rejected: number }> = {}
    for (const s of sims) {
      if (!s.certified_by) continue
      if (!certsByReviewer[s.certified_by]) certsByReviewer[s.certified_by] = { certified: 0, rejected: 0 }
      if (s.cert_status === 'certified') certsByReviewer[s.certified_by].certified++
      else if (s.cert_status === 'rejected') certsByReviewer[s.certified_by].rejected++
    }

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
        comments:  commentsByReviewer[id] ?? 0,
        certified: certsByReviewer[id]?.certified ?? 0,
        rejected:  certsByReviewer[id]?.rejected ?? 0,
      }))
      .sort((a, b) => (b.comments + b.certified * 2) - (a.comments + a.certified * 2))
      .slice(0, 10)
  }

  const totalCertReviewed = certifiedCount + rejectedCount
  const certApprovalRate = totalCertReviewed > 0
    ? Math.round((certifiedCount / totalCertReviewed) * 100)
    : 0

  // Difficulty chart data
  const difficultyBars = ['Foundation', 'Practitioner', 'Advanced']
    .map(k => ({
      label: k,
      value: byDifficulty[k] ?? 0,
      color: DIFFICULTY_STYLE[k]?.color ?? '#6b7280',
    }))
    .filter(d => d.value > 0)

  // Industry chart data
  const industryBars = topIndustries.slice(0, 6).map(([label, value]) => ({
    label,
    value,
    color: '#4DC5D2',
  }))

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="font-bold text-2xl tracking-tight"
            style={{ color: '#003359', letterSpacing: '-0.01em' }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(0,51,89,0.45)' }}>
            Platform overview & analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton />
          <Link
            href="/admin/simulations/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#003359' }}
          >
            <Plus size={14} />
            New Simulation
          </Link>
        </div>
      </div>

      {/* ── Row 1: Hero card + 3 stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroCard
          total={total}
          published={publishedCount}
          drafts={draftCount}
          pendingCount={pendingReview.length}
        />
        <StatCard
          label="Published"
          value={publishedCount}
          icon={CheckCircle2}
          accentColor="#16a34a"
          iconBg="#f0fdf4"
          sub={publishedLast30 > 0 ? `+${publishedLast30} this month` : 'Visible to candidates'}
          href="/admin/simulations?status=published"
        />
        <StatCard
          label="Pending Review"
          value={byStatus.pending_review ?? 0}
          icon={Clock}
          accentColor="#006FAD"
          iconBg="#eff6ff"
          sub={stalePending.length > 0 ? `${stalePending.length} overdue (7d+)` : 'Awaiting approval'}
          href="/admin/simulations?status=pending_review"
        />
        <StatCard
          label="Drafts"
          value={draftCount}
          icon={Edit3}
          accentColor="#94a3b8"
          iconBg="#f1f5f9"
          sub="In progress"
          href="/admin/simulations?status=draft"
        />
      </div>

      {/* ── Row 2: Status donut + Pending queue ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Status donut */}
        <SectionCard title="Status Distribution" icon={BarChart2} noPad>
          <div className="p-5 flex flex-col items-center">
            <DonutChart
              segments={statusSegments}
              total={total}
              subtitle="simulations"
              size={148}
            />
            <div className="w-full mt-5 space-y-2.5">
              {statusSegments.map(seg => (
                <div key={seg.label} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs flex-1" style={{ color: 'rgba(0,51,89,0.6)' }}>
                    {seg.label}
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#003359' }}>
                    {seg.count}
                  </span>
                  <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(0,51,89,0.32)' }}>
                    {Math.round(seg.pct)}%
                  </span>
                </div>
              ))}
              {total === 0 && (
                <p className="text-xs text-center py-2" style={{ color: 'rgba(0,51,89,0.35)' }}>
                  No simulations yet
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Pending queue / Recent */}
        {pendingReview.length > 0 ? (
          <SectionCard
            title={`Awaiting Approval (${pendingReview.length})`}
            icon={Clock}
            action={{ href: '/admin/simulations?status=pending_review', label: 'View all' }}
            noPad
          >
            <div>
              {pendingReview.slice(0, 6).map(sim => (
                <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}`} />
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title="Recently Edited"
            icon={TrendingUp}
            action={{ href: '/admin/simulations', label: 'View all' }}
            noPad
          >
            <div>
              {recent.slice(0, 6).map(sim => (
                <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}`} />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Stale pending alert ───────────────────────────────────────────────── */}
      {showFullAnalytics && stalePending.length > 0 && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
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
                  className="text-xs px-2 py-0.5 rounded-lg border font-medium hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}
                >
                  {s.title ?? s.slug}
                  <span className="ml-1.5 opacity-55">
                    {formatDistanceToNow(new Date(s.updated_at!), { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Super admin analytics ─────────────────────────────────────────────── */}
      {showFullAnalytics && (
        <>
          {/* Row 3: Certification health + Team composition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Certification health */}
            <SectionCard title="Certification Health" icon={ShieldCheck} noPad>
              <div className="p-6">
                <div className="flex items-end gap-4 mb-5">
                  <div>
                    <div
                      className="text-4xl font-bold"
                      style={{ color: '#003359', letterSpacing: '-0.02em' }}
                    >
                      {certApprovalRate}%
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(0,51,89,0.45)' }}>
                      approval rate
                    </div>
                  </div>
                  {totalCertReviewed > 0 && (
                    <div className="flex-1 pb-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#eef2f7' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${certApprovalRate}%`, backgroundColor: '#16a34a' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Certified',  count: certifiedCount,   color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Rejected',   count: rejectedCount,    color: '#e11d48', bg: '#fff1f2' },
                    { label: 'Unreviewed', count: certPendingCount, color: '#d97706', bg: '#fffbeb' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className="rounded-xl p-3.5 text-center" style={{ backgroundColor: bg }}>
                      <div className="text-2xl font-bold" style={{ color }}>{count}</div>
                      <div className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color }}>
                        {label}
                      </div>
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
            <SectionCard title="Team Composition" icon={Users} action={{ href: '/admin/team', label: 'Manage' }} noPad>
              <div className="px-6 py-5 space-y-4">
                {Object.entries(byRole)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, count]) => {
                    const totalUsers = Object.values(byRole).reduce((a, b) => a + b, 0)
                    const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
                    return (
                      <div key={role}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-medium" style={{ color: 'rgba(0,51,89,0.65)' }}>
                            {ROLE_LABELS[role] ?? role}
                          </span>
                          <span className="text-sm font-bold" style={{ color: '#003359' }}>
                            {count}
                            <span className="font-normal text-xs ml-1" style={{ color: 'rgba(0,51,89,0.38)' }}>
                              ({pct}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#eef2f7' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: '#4DC5D2' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(byRole).length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>
                    No team members yet
                  </p>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Row 4: Industry coverage + Difficulty breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Industry coverage */}
            <SectionCard title="Industry Coverage" icon={Globe} noPad>
              <div className="px-6 py-5">
                {industryBars.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>
                    No industry data
                  </p>
                ) : (
                  <MiniBarChart data={industryBars} />
                )}
              </div>
            </SectionCard>

            {/* Difficulty breakdown */}
            <SectionCard title="By Difficulty" icon={BarChart2} noPad>
              <div className="px-6 py-5">
                {difficultyBars.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>
                    No simulations yet
                  </p>
                ) : (
                  <MiniBarChart data={difficultyBars} />
                )}
                <div
                  className="mt-4 pt-4 flex justify-between text-xs"
                  style={{ borderTop: '1px solid #eef2f7', color: 'rgba(0,51,89,0.45)' }}
                >
                  <span>Total simulations</span>
                  <span className="font-bold" style={{ color: '#003359' }}>{total}</span>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Row 5: Reviewer leaderboard */}
          {reviewerLeaderboard.length > 0 && (
            <SectionCard title="Reviewer Leaderboard" icon={Award} action={{ href: '/admin/team', label: 'Manage team' }} noPad>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eef2f7', backgroundColor: '#f8fafd' }}>
                      {['#', 'Reviewer', 'Comments', 'Certified', 'Rejected', 'Score'].map(h => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: 'rgba(0,51,89,0.42)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewerLeaderboard.map((r, idx) => {
                      const totalActions = r.comments + r.certified + r.rejected
                      const maxScore = reviewerLeaderboard[0]
                        ? reviewerLeaderboard[0].comments + reviewerLeaderboard[0].certified * 2 + reviewerLeaderboard[0].rejected
                        : 1
                      const score = r.comments + r.certified * 2 + r.rejected
                      const scorePct = Math.round((score / maxScore) * 100)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                          <td className="px-5 py-3">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: idx === 0 ? '#fef9c3' : idx === 1 ? '#f1f5f9' : '#f8fafc',
                                color: idx === 0 ? '#a16207' : '#475569',
                              }}
                            >
                              {idx + 1}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-medium truncate max-w-[160px] block" style={{ color: '#003359' }}>
                              {r.email}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare size={12} style={{ color: '#94a3b8' }} />
                              <span className="font-semibold" style={{ color: '#003359' }}>{r.comments}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                            >
                              {r.certified}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}
                            >
                              {r.rejected}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs" style={{ color: '#003359' }}>{score}</span>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#eef2f7' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${scorePct}%`, backgroundColor: '#4DC5D2' }}
                                />
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

          {/* Row 6: Recent cert decisions + recently edited */}
          <div className={`grid gap-4 ${recentCerts.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {recentCerts.length > 0 && (
              <SectionCard title="Recent Cert Decisions" icon={ShieldCheck} noPad>
                <div>
                  {recentCerts.map(sim => {
                    const cert = sim.cert_status ?? 'pending'
                    const cs = CERT_STYLE[cert] ?? CERT_STYLE.pending
                    return (
                      <Link
                        key={sim.slug}
                        href={`/admin/simulations/${sim.slug}/reviews`}
                        className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[#f8fafd]"
                        style={{ borderBottom: '1px solid #f0f4f8' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>
                            {sim.title ?? sim.slug}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(0,51,89,0.4)' }}>
                            {sim.certified_at
                              ? formatDistanceToNow(new Date(sim.certified_at), { addSuffix: true })
                              : ''}
                          </div>
                        </div>
                        <span
                          className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold shrink-0"
                          style={{ backgroundColor: cs.bg, color: cs.color }}
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
              noPad
            >
              <div>
                {recent.slice(0, 6).map(sim => (
                  <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}`} showCert />
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}

      {/* Non-super admin: simple 2-column layout */}
      {!showFullAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <SectionCard
            title="Recently Edited"
            action={{ href: '/admin/simulations', label: 'View all' }}
            noPad
          >
            <div>
              {recent.map(sim => (
                <SimRow key={sim.slug} sim={sim} href={`/admin/simulations/${sim.slug}`} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By Difficulty" icon={BarChart2} noPad>
            <div className="px-6 py-5">
              {difficultyBars.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>No simulations yet</p>
              ) : (
                <MiniBarChart data={difficultyBars} />
              )}
              <div
                className="mt-4 pt-4 flex justify-between text-xs"
                style={{ borderTop: '1px solid #eef2f7', color: 'rgba(0,51,89,0.45)' }}
              >
                <span>Total</span>
                <span className="font-bold" style={{ color: '#003359' }}>{total}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

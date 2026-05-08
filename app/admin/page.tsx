// 'use client'
import React from 'react'
import { getSimulations } from '@/lib/data'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { FileText, CheckCircle2, Edit3, BarChart2, ExternalLink } from 'lucide-react'

type AdminSimulation = {
  slug: string
  title?: string | null
  difficulty?: string | null
  updated_at?: string | null
  prompts?: unknown[] | null
}

const DIFFICULTY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Foundation:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Practitioner: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Advanced:     { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}
const FALLBACK_DIFFICULTY = { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }

export default async function AdminPage() {
  const sims = (await getSimulations()) as unknown as AdminSimulation[]
  const total = sims.length
  const live = sims.filter(s => s.prompts && (s.prompts as unknown[]).length > 0).length
  const drafts = total - live
  const byDifficulty = sims.reduce<Record<string, number>>((acc, s) => {
    const key = s.difficulty ?? 'Unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const recent = sims
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
    )
    .slice(0, 8)

  const stats = [
    {
      label: 'Total Simulations',
      value: total,
      icon: FileText,
      iconBg: 'rgba(58, 152, 162, 0.1)',
      iconColor: '#003259e4',
      stripe: '#003259e4',
    },
    {
      label: 'Live',
      value: live,
      icon: CheckCircle2,
      iconBg: '#f0fdf4',
      iconColor: '#003259e4',
      stripe: '#003259e4',
    },
    {
      label: 'Drafts',
      value: drafts,
      icon: Edit3,
      iconBg: '#fffbeb',
      iconColor: '#003259e4',
      stripe: '#003259e4',
    },
    {
      label: 'Difficulty Types',
      value: Object.keys(byDifficulty).length,
      icon: BarChart2,
      iconBg: 'rgba(0,51,89,0.06)',
      iconColor: '#003259e4',
      stripe: '#003259e4',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page header */}
      <div>
        <h1 className="font-bold text-2xl tracking-tight" style={{ color: '#003359' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(0,51,89,0.45)' }}>
          Overview of your simulation library
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-5">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, stripe }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #17233753',
              borderLeft: `2px solid ${stripe}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgba(0,51,89,0.45)' }}
                >
                  {label}
                </div>
                <div className="text-3xl font-bold" style={{ color: '#003359' }}>
                  {value}
                </div>
              </div>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: iconBg }}
              >
                <Icon size={17} style={{ color: iconColor }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lower grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Recent activity */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #d5dce8',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid #d5dce8' }}
          >
            <span className="font-semibold text-sm" style={{ color: '#003359' }}>
              Recently Edited
            </span>
            <Link
              href="/admin/simulations"
              className="text-xs font-medium transition-colors"
              style={{ color: '#4dc5d2' }}
            >
              View all →
            </Link>
          </div>

          <div>
            {recent.map(r => {
              const diff = r.difficulty ?? 'Unknown'
              const ds = DIFFICULTY_STYLE[diff] ?? FALLBACK_DIFFICULTY
              return (
                <Link
                  key={r.slug}
                  href={`/admin/simulations/${r.slug}`}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors group hover:bg-[#f5f7fb]"
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(0,51,89,0.05)' }}
                  >
                    <FileText size={14} style={{ color: 'rgba(0,51,89,0.35)' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: '#003359' }}>
                      {r.title || r.slug}
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(0,51,89,0.4)' }}>
                      {r.slug}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {r.difficulty && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: ds.bg,
                          color: ds.color,
                          border: `1px solid ${ds.border}`,
                        }}
                      >
                        {r.difficulty}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'rgba(0,51,89,0.3)' }}>
                      {formatDistanceToNow(new Date(r.updated_at ?? new Date().toISOString()))} ago
                    </span>
                    <ExternalLink
                      size={12}
                      style={{ color: 'rgba(0,51,89,0.2)', transition: 'color 0.15s' }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Difficulty breakdown */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #d5dce8',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="px-6 py-4"
            style={{ borderBottom: '1px solid #d5dce8' }}
          >
            <span className="font-semibold text-sm" style={{ color: '#003359' }}>
              By Difficulty
            </span>
          </div>
          <div className="px-6 py-5 space-y-5">
            {Object.entries(byDifficulty).map(([k, v]) => {
              const pct = total > 0 ? Math.round((v / total) * 100) : 0
              const ds = DIFFICULTY_STYLE[k] ?? FALLBACK_DIFFICULTY
              return (
                <div key={k}>
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: ds.bg,
                        color: ds.color,
                        border: `1px solid ${ds.border}`,
                      }}
                    >
                      {k}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: '#003359' }}>
                      {v}
                      <span className="font-normal text-xs ml-1" style={{ color: 'rgba(0,51,89,0.4)' }}>
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: ds.color }}
                    />
                  </div>
                </div>
              )
            })}

            {Object.keys(byDifficulty).length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(0,51,89,0.35)' }}>
                No simulations yet
              </p>
            )}
          </div>

          {/* Summary footer */}
          <div
            className="px-6 py-4 mt-auto"
            style={{ borderTop: '1px solid #d5dce8', backgroundColor: '#f9fafb' }}
          >
            <div className="flex justify-between text-xs" style={{ color: 'rgba(0,51,89,0.5)' }}>
              <span>Total simulations</span>
              <span className="font-semibold" style={{ color: '#003359' }}>
                {total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

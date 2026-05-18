import React from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, MessageSquare, ShieldCheck, Clock, Video } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Comment = {
  id: string
  reviewer_id: string
  reviewer_label: string | null
  reviewer_email: string | null
  section_key: string
  selected_text: string
  comment: string
  timestamp_seconds: number | null
  created_at: string
}

const CERT_STYLE = {
  certified: { label: 'Certified',    bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  rejected:  { label: 'Rejected',     bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
  pending:   { label: 'Pending',      bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
} as const

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function sectionLabel(key: string): string {
  if (key === 'brief') return 'Brief'
  if (key === 'rubric') return 'Rubric'
  if (key === 'video') return 'Video'
  if (key.startsWith('prompt-')) return `Prompt ${key.replace('prompt-', '').slice(0, 6)}…`
  return key
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  try {
    await requireAdmin()
  } catch {
    redirect('/auth/login')
  }

  const { slug } = await params

  const { data: sim, error: simErr } = await supabaseServer
    .from('simulations')
    .select('id, title, slug, cert_status, cert_notes, certified_by, certified_at')
    .eq('slug', slug)
    .single()

  if (simErr || !sim) notFound()

  const { data: commentsRaw } = await supabaseServer
    .from('simulation_comments')
    .select('id, reviewer_id, reviewer_label, section_key, selected_text, comment, timestamp_seconds, created_at')
    .eq('simulation_id', sim.id)
    .order('created_at', { ascending: true })

  // Enrich reviewer emails
  const reviewerIds = [...new Set((commentsRaw ?? []).map(c => c.reviewer_id))]
  let emailMap: Record<string, string> = {}
  if (reviewerIds.length > 0) {
    const { data: roles } = await supabaseServer
      .from('user_roles')
      .select('user_id, email')
      .in('user_id', reviewerIds)
    for (const r of roles ?? []) {
      if (r.email) emailMap[r.user_id] = r.email
    }
  }

  let certifiedByEmail: string | null = null
  if (sim.certified_by) {
    certifiedByEmail = emailMap[sim.certified_by] ?? null
    if (!certifiedByEmail) {
      const { data: r } = await supabaseServer
        .from('user_roles')
        .select('email')
        .eq('user_id', sim.certified_by)
        .maybeSingle()
      certifiedByEmail = r?.email ?? null
    }
  }

  const comments: Comment[] = (commentsRaw ?? []).map(c => ({
    ...c,
    reviewer_email: emailMap[c.reviewer_id] ?? null,
    timestamp_seconds: c.timestamp_seconds ?? null,
  }))

  // Group by section_key
  const bySection = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (!acc[c.section_key]) acc[c.section_key] = []
    acc[c.section_key].push(c)
    return acc
  }, {})

  const certKey = (sim.cert_status ?? 'pending') as keyof typeof CERT_STYLE
  const certStyle = CERT_STYLE[certKey] ?? CERT_STYLE.pending

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/admin/simulations/${slug}`}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              {sim.title ?? slug}
            </h1>
          </div>
          <p className="text-sm text-slate-500">Reviewer results for this simulation</p>
        </div>
      </div>

      {/* Certification card */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${certStyle.border}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: certStyle.bg }}
            >
              <ShieldCheck size={16} style={{ color: certStyle.color }} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(0,51,89,0.45)' }}>
                Certification Status
              </div>
              <span
                className="text-sm font-semibold px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: certStyle.bg,
                  color: certStyle.color,
                  borderColor: certStyle.border,
                }}
              >
                {certStyle.label}
              </span>
            </div>
          </div>
          {sim.certified_by && (
            <div className="text-right">
              <div className="text-xs text-slate-400">Reviewed by</div>
              <div className="text-sm font-medium text-slate-700">{certifiedByEmail ?? 'Unknown'}</div>
              {sim.certified_at && (
                <div className="text-xs text-slate-400 mt-0.5">
                  {formatDistanceToNow(new Date(sim.certified_at), { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </div>
        {sim.cert_notes && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</div>
            <p className="text-sm text-slate-700 leading-relaxed">{sim.cert_notes}</p>
          </div>
        )}
      </div>

      {/* Comments */}
      {comments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center">
          <MessageSquare size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No reviewer comments yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(bySection).map(([sectionKey, sectionComments]) => (
            <div
              key={sectionKey}
              className="bg-white rounded-xl overflow-hidden border border-slate-200"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              {/* Section header */}
              <div
                className="px-6 py-3.5 flex items-center gap-2 border-b border-slate-200"
                style={{ backgroundColor: '#f8fafc' }}
              >
                {sectionKey === 'video' ? (
                  <Video size={13} className="text-slate-500" />
                ) : (
                  <MessageSquare size={13} className="text-slate-500" />
                )}
                <span className="text-sm font-semibold text-slate-700">
                  {sectionLabel(sectionKey)}
                </span>
                <span className="ml-auto text-xs text-slate-400">{sectionComments.length} comment{sectionComments.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Comment list */}
              <div className="divide-y divide-slate-100">
                {sectionComments.map(c => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center text-xs font-bold text-teal shrink-0">
                        {(c.reviewer_label || c.reviewer_email || 'R')[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-slate-700">
                        {c.reviewer_label || c.reviewer_email || 'Reviewer'}
                      </span>
                      {c.timestamp_seconds !== null && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          <Clock size={10} />
                          {formatTime(c.timestamp_seconds)}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {c.selected_text && (
                      <blockquote className="text-xs text-slate-500 border-l-2 border-slate-300 pl-3 mb-2 italic leading-relaxed">
                        {c.selected_text}
                      </blockquote>
                    )}
                    <p className="text-sm text-slate-700 leading-relaxed">{c.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

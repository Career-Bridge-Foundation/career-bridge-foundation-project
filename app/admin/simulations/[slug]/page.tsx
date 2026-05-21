'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, X, Loader2, ExternalLink, Clock, Building2, Send, MessageSquare, Video, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import {
  Button,
  Input,
  SegmentedControl,
  Badge,
  Skeleton,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@/components/ui'
import { SimulationMetadataSchema as SimulationMetaSchema, type SimulationMetadata as SimulationMeta } from '@/lib/schemas/simulation'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/cn'
import { formatDistanceToNow } from 'date-fns'

// ── Activity types ────────────────────────────────────────────────────────────
type ActivityEntry = {
  id: string
  action: 'created' | 'updated_metadata' | 'updated_content' | 'deleted'
  user_email: string
  diff: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated_metadata: 'Metadata updated',
  updated_content: 'Content updated',
  deleted: 'Deleted',
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  updated_metadata: 'bg-teal/10 text-teal border-teal/20',
  updated_content: 'bg-amber-50 text-amber-700 border-amber-200',
  deleted: 'bg-red-50 text-red-700 border-red-200',
}

function ActivityTimeline({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  useEffect(() => {
    fetch(`/api/admin/simulations/${slug}/activity`)
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5" />
              {i < 3 && <div className="w-px flex-1 bg-slate-200 mt-1.5" />}
            </div>
            <div className="pb-6 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 rounded-full bg-slate-100" />
                <div className="h-3 w-32 rounded bg-slate-100" />
              </div>
              <div className="h-3 w-48 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-400 text-sm">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-0">
      {entries.map((entry, i) => {
        const hasDiff = entry.diff && Object.keys(entry.diff).length > 0
        const isExpanded = expandedIds.has(entry.id)
        return (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#4c6ef5' }} />
              {i < entries.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className="pb-6 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span
                  className={cn(
                    'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
                    ACTION_COLORS[entry.action] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-slate-600 truncate">{entry.user_email}</p>
              {hasDiff && (
                <button
                  onClick={() => toggleExpanded(entry.id)}
                  className="mt-1 text-xs text-teal hover:text-teal/80 transition-colors"
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>
              )}
              {isExpanded && hasDiff && (
                <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-md p-3 overflow-auto max-h-40 border border-slate-200">
                  {JSON.stringify(entry.diff, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; selectedClass: string }> = {
  draft:          { label: 'Draft',          selectedClass: 'bg-slate-100 text-slate-700 border-slate-400' },
  pending_review: { label: 'Pending Review', selectedClass: 'bg-blue-50 text-blue-700 border-blue-400' },
  published:      { label: 'Published',      selectedClass: 'bg-emerald-50 text-emerald-700 border-emerald-400' },
  archived:       { label: 'Archived',       selectedClass: 'bg-amber-50 text-amber-700 border-amber-400' },
}

const DIFFICULTY_OPTIONS = [
  { label: 'Foundation', value: 'Foundation' },
  { label: 'Practitioner', value: 'Practitioner' },
  { label: 'Advanced', value: 'Advanced' },
]

const DIFF_BADGE: Record<string, string> = {
  Foundation: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Practitioner: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced: 'bg-rose-50 text-rose-700 border-rose-200',
}

const DIFF_PREVIEW: Record<string, { bg: string; color: string; border: string }> = {
  Foundation: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Practitioner: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Advanced: { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

function SlugIndicator({ status }: { status: SlugStatus }) {
  if (status === 'checking') return <Loader2 size={13} className="animate-spin text-slate-400" />
  if (status === 'available') return <Check size={13} className="text-emerald-600" />
  if (status === 'taken') return <X size={13} className="text-red-600" />
  return null
}

function SimPreview({ data }: { data: Partial<SimulationMeta> }) {
  const diff = data.difficulty
  const diffStyle = diff ? DIFF_PREVIEW[diff] : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Building2 size={14} className="text-slate-400" />
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">
          {data.company || 'Company'}
        </span>
      </div>
      <h3 className="font-semibold text-slate-900 text-[15px] leading-snug mb-3 min-h-[42px]">
        {data.title || 'Simulation title'}
      </h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {data.industry && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {data.industry}
          </span>
        )}
        {diffStyle && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium border"
            style={{ backgroundColor: diffStyle.bg, color: diffStyle.color, borderColor: diffStyle.border }}
          >
            {data.difficulty}
          </span>
        )}
        {data.time && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
            <Clock size={10} /> {data.time}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 min-h-[63px]">
        {data.description || 'Description will appear here…'}
      </p>
    </div>
  )
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // YouTube
    const ytId =
      (u.hostname === 'youtu.be' && u.pathname.slice(1)) ||
      (u.hostname.includes('youtube.com') && (u.searchParams.get('v') || u.pathname.split('/').pop()))
    if (ytId) return `https://www.youtube.com/embed/${ytId}`
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://www.loom.com/embed/${id}`
    }
  } catch {
    // invalid URL
  }
  return null
}

function VideoPreviewPanel({ videoUrl }: { videoUrl: string | null }) {
  if (!videoUrl) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Video size={20} className="text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No video URL set</p>
        <p className="text-xs text-slate-400">Add a video URL in the Metadata tab to enable preview.</p>
      </div>
    )
  }

  const embedUrl = getEmbedUrl(videoUrl)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-teal" />
          <h3 className="text-sm font-semibold text-slate-900">Video Preview</h3>
        </div>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-teal hover:text-teal/80 transition-colors"
        >
          Open original <ExternalLink size={11} />
        </a>
      </div>

      {embedUrl ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Simulation video preview"
          />
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              This URL cannot be embedded directly. Use YouTube, Vimeo, or Loom for inline preview.
            </p>
          </div>
          <video
            src={videoUrl}
            controls
            className="w-full rounded-lg border border-slate-200"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-5 w-48 rounded" />
      </div>
      <div className="bg-white rounded-xl p-6 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EditSimulationPage() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const reduced = useReducedMotion()

  const [isLoading, setIsLoading] = useState(true)
  const [simData, setSimData] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<'metadata' | 'video' | 'activity'>('metadata')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'submit' | 'approve' | 'reject' | null>(null)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const slugManuallyEdited = useRef(false)
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SimulationMeta>({
    resolver: zodResolver(SimulationMetaSchema),
    defaultValues: {
      title: '',
      company: '',
      industry: '',
      type: '',
      difficulty: 'Foundation',
      time: '',
      description: '',
      discipline: '',
      video_url: '',
      status: 'draft' as const,
      slug: '',
    },
    mode: 'onBlur',
  })

  const watchedAll = watch()
  const descLen = (watchedAll.description ?? '').length

  // Fetch current user's role for role-aware UI
  useEffect(() => {
    fetch('/api/admin/me')
      .then(r => r.json())
      .then(d => setUserRole(d.role ?? null))
      .catch(() => {})
  }, [])

  // Load sim data
  useEffect(() => {
    fetch(`/api/admin/simulations/${slug}`)
      .then(r => r.json())
      .then(data => {
        setSimData(data)
        reset({
          title: data.title ?? '',
          company: data.company ?? '',
          industry: data.industry ?? '',
          type: data.type ?? '',
          difficulty: data.difficulty ?? 'Foundation',
          time: data.time ?? '',
          description: data.description ?? '',
          discipline: data.discipline ?? '',
          video_url: data.video_url ?? '',
          status: data.status ?? 'draft',
          slug: data.slug ?? slug,
        })
        setIsLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load simulation')
        setIsLoading(false)
      })
  }, [slug, reset])

  async function checkSlug(value: string) {
    if (!value || value.length < 2) { setSlugStatus('idle'); return }
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    setSlugStatus('checking')
    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/simulations/check-slug?slug=${encodeURIComponent(value)}&except=${encodeURIComponent(slug)}`
        )
        const { available } = await res.json()
        setSlugStatus(available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 300)
  }

  const onSubmit = async (data: SimulationMeta) => {
    const res = await fetch(`/api/admin/simulations/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      const updated = await res.json()
      toast.success('Changes saved')
      reset(data)
      setSimData(updated)
      if (updated.slug !== slug) {
        router.replace(`/admin/simulations/${updated.slug}`)
      }
    } else {
      const json = await res.json()
      if (json.fieldErrors) {
        Object.entries(json.fieldErrors as Record<string, string[]>).forEach(([key, msgs]) => {
          setError(key as keyof SimulationMeta, { message: msgs[0] })
        })
        toast.error('Please fix the highlighted fields')
      } else {
        toast.error('Failed to save changes')
      }
    }
  }

  async function handleSubmitForReview() {
    setActionLoading('submit')
    const res = await fetch(`/api/admin/simulations/${slug}/submit`, { method: 'POST' })
    if (res.ok) {
      toast.success('Submitted for review')
      setSimData(prev => ({ ...prev, status: 'pending_review' }))
      setValue('status', 'pending_review' as never, { shouldDirty: false })
    } else {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to submit for review')
    }
    setActionLoading(null)
  }

  async function handleApprove() {
    setActionLoading('approve')
    const res = await fetch(`/api/admin/simulations/${slug}/approve`, { method: 'POST' })
    if (res.ok) {
      toast.success('Approved — simulation is now published')
      const now = new Date().toISOString()
      setSimData(prev => ({ ...prev, status: 'published', published_at: prev?.published_at ?? now }))
      setValue('status', 'published' as never, { shouldDirty: false })
    } else {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to approve')
    }
    setActionLoading(null)
  }

  async function handleReject() {
    setActionLoading('reject')
    const res = await fetch(`/api/admin/simulations/${slug}/reject`, { method: 'POST' })
    if (res.ok) {
      toast.success('Returned to draft')
      setSimData(prev => ({ ...prev, status: 'draft' }))
      setValue('status', 'draft' as never, { shouldDirty: false })
    } else {
      const json = await res.json()
      toast.error(json.error ?? 'Failed to reject')
    }
    setActionLoading(null)
  }

  if (isLoading) return <PageSkeleton />

  const updatedAt = simData?.updated_at ? new Date(simData.updated_at as string) : null

  return (
    <>
      <div className="space-y-6 pb-24">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/admin/simulations"
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={14} />
              </Link>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {(simData?.title as string) || slug}
              </h1>
              <Badge
                variant="neutral"
                size="sm"
                className="bg-slate-100 text-slate-600 text-xs border border-slate-300"
              >
                {slug}
              </Badge>
            </div>
            {updatedAt && (
              <p className="text-sm text-slate-500">
                Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ExternalLink size={12} />}
              onClick={() => router.push(`/admin/simulations/${slug}/content`)}
            >
              Edit content
            </Button>
            <Button
              type="submit"
              form="metadata-form"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs>
          <TabList>
            <Tab
              id="metadata"
              active={activeTab === 'metadata'}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata
            </Tab>
            <Link
              href={`/admin/simulations/${slug}/content`}
              className="px-3 py-2 text-sm rounded-md text-slate-600 hover:text-slate-900 transition-colors"
            >
              Content
            </Link>
            <Tab
              id="video"
              active={activeTab === 'video'}
              onClick={() => setActiveTab('video')}
            >
              <span className="flex items-center gap-1.5">
                <Video size={13} />
                Video
              </span>
            </Tab>
            <Tab
              id="activity"
              active={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </Tab>
            {userRole && userRole !== 'content_developer' && (
              <Link
                href={`/admin/simulations/${slug}/reviews`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md text-slate-600 hover:text-slate-900 transition-colors"
              >
                <MessageSquare size={13} />
                Reviews
              </Link>
            )}
          </TabList>
        </Tabs>

        {/* Metadata panel */}
        <TabPanel hidden={activeTab !== 'metadata'}>
          <form id="metadata-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-12 gap-6">
              {/* ── Form ── */}
              <div className="col-span-12 lg:col-span-8 space-y-5">
                <div className="bg-white rounded-xl p-6 space-y-5 border border-slate-200">

                  {/* Status */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 text-sm font-medium">Status</label>

                    {userRole === 'content_developer' ? (
                      /* Content developer: read-only status + submit button */
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'px-3 py-1.5 rounded-md text-sm font-medium border',
                            STATUS_CONFIG[watchedAll.status ?? 'draft']?.selectedClass
                          )}
                        >
                          {STATUS_CONFIG[watchedAll.status ?? 'draft']?.label ?? watchedAll.status}
                        </span>
                        {watchedAll.status === 'draft' && (
                          <button
                            type="button"
                            disabled={!!actionLoading || isDirty}
                            onClick={handleSubmitForReview}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            <Send size={13} />
                            {actionLoading === 'submit' ? 'Submitting…' : 'Submit for Review'}
                          </button>
                        )}
                        {isDirty && watchedAll.status === 'draft' && (
                          <p className="text-xs text-amber-600">Save your changes before submitting</p>
                        )}
                      </div>
                    ) : (
                      /* Admin / super_admin: full status selector */
                      <>
                        <div className="flex gap-2 flex-wrap">
                          {(['draft', 'pending_review', 'published', 'archived'] as const).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setValue('status', s, { shouldDirty: true })}
                              className={cn(
                                'flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors',
                                watchedAll.status === s
                                  ? STATUS_CONFIG[s]?.selectedClass
                                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                              )}
                            >
                              {STATUS_CONFIG[s]?.label ?? s}
                            </button>
                          ))}
                        </div>

                        {/* Approve / Reject actions when pending review */}
                        {(simData?.status === 'pending_review' || watchedAll.status === 'pending_review') && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={handleApprove}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <Check size={13} />
                              {actionLoading === 'approve' ? 'Approving…' : 'Approve & Publish'}
                            </button>
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={handleReject}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                              <X size={13} />
                              {actionLoading === 'reject' ? 'Rejecting…' : 'Reject (back to draft)'}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {!!simData?.published_at && (
                      <p className="text-xs text-slate-400">
                        Published {formatDistanceToNow(new Date(simData.published_at as string), { addSuffix: true }) as string}
                      </p>
                    )}
                  </div>

                  <Input
                    id="title"
                    label="Title"
                    error={errors.title?.message}
                    {...register('title')}
                  />

                  <Input
                    id="company"
                    label="Company"
                    error={errors.company?.message}
                    {...register('company')}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      id="industry"
                      label="Industry"
                      error={errors.industry?.message}
                      {...register('industry')}
                    />
                    <Input
                      id="type"
                      label="Type"
                      error={errors.type?.message}
                      {...register('type')}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 text-sm font-medium">Difficulty</label>
                    <SegmentedControl
                      options={DIFFICULTY_OPTIONS}
                      value={watchedAll.difficulty ?? 'Foundation'}
                      onChange={v =>
                        setValue('difficulty', v as SimulationMeta['difficulty'], {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                    {errors.difficulty && (
                      <p className="text-red-600 text-sm">{errors.difficulty.message}</p>
                    )}
                  </div>

                  <Input
                    id="time"
                    label="Time"
                    error={errors.time?.message}
                    {...register('time')}
                  />

                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="description" className="text-slate-900 text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={4}
                      maxLength={280}
                      className={cn(
                        'bg-white text-slate-900 rounded-md px-3 py-2 border border-slate-300',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/20',
                        'resize-none text-sm placeholder:text-slate-400',
                        errors.description && 'border-red-500'
                      )}
                      {...register('description')}
                    />
                    <div className="flex justify-between items-center">
                      {errors.description ? (
                        <p className="text-red-600 text-sm">{errors.description.message}</p>
                      ) : <span />}
                      <span className={cn('text-xs', descLen > 260 ? 'text-amber-600' : 'text-slate-400')}>
                        {descLen}/280
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      id="discipline"
                      label="Discipline"
                      placeholder="e.g. Product Management"
                      error={errors.discipline?.message}
                      {...register('discipline')}
                    />
                    <Input
                      id="video_url"
                      label="Video URL"
                      type="url"
                      placeholder="https://…"
                      error={errors.video_url?.message}
                      {...register('video_url')}
                    />
                  </div>

                  {/* Slug */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-slug" className="text-slate-900 text-sm font-medium">
                      Slug
                    </label>
                    <div className="relative">
                      <input
                        id="edit-slug"
                        type="text"
                        className={cn(
                          'w-full bg-white text-slate-900 rounded-md px-3 py-2 pr-8 border border-slate-300 text-sm',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 placeholder:text-slate-400',
                          errors.slug && 'border-red-500',
                          slugStatus === 'available' && 'border-emerald-500',
                          slugStatus === 'taken' && 'border-red-500'
                        )}
                        {...register('slug', {
                          onChange: () => {
                            slugManuallyEdited.current = true
                            setSlugStatus('idle')
                          },
                        })}
                        onBlur={e => checkSlug(e.target.value)}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <SlugIndicator status={slugStatus} />
                      </span>
                    </div>
                    {errors.slug && (
                      <p className="text-red-600 text-sm">{errors.slug.message}</p>
                    )}
                    {!errors.slug && slugStatus === 'available' && (
                      <p className="text-emerald-600 text-sm">Slug is available</p>
                    )}
                    {!errors.slug && slugStatus === 'taken' && (
                      <p className="text-red-600 text-sm">Slug is already taken</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Live preview ── */}
              <div className="col-span-12 lg:col-span-4">
                <div className="sticky top-6 space-y-3">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                    Public preview
                  </p>
                  <SimPreview data={watchedAll} />
                </div>
              </div>
            </div>
          </form>
        </TabPanel>

        {/* Video preview */}
        <TabPanel hidden={activeTab !== 'video'}>
          <VideoPreviewPanel videoUrl={(simData?.video_url as string) || null} />
        </TabPanel>

        {/* Activity log */}
        <TabPanel hidden={activeTab !== 'activity'}>
          <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 50 changes to this simulation</p>
            </div>
            <ActivityTimeline slug={slug} />
          </div>
        </TabPanel>
      </div>

      {/* Sticky save bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={reduced ? false : { y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: 56, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-4 bg-white border-t border-slate-200"
          >
            <p className="text-sm text-slate-600">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { reset(); setSlugStatus('idle') }}>
                Discard
              </Button>
              <Button
                type="submit"
                form="metadata-form"
                variant="primary"
                size="sm"
                disabled={isSubmitting || slugStatus === 'taken'}
              >
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

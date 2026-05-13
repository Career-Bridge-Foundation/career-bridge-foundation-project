'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Loader2, Clock, Building2 } from 'lucide-react'
import Link from 'next/link'
import { Button, Input, SegmentedControl, Badge } from '@/components/ui'
import { SimulationMetaSchema, type SimulationMeta } from '@/lib/validations/simulation'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/cn'

const DIFFICULTY_OPTIONS = [
  { label: 'Foundation', value: 'Foundation' },
  { label: 'Practitioner', value: 'Practitioner' },
  { label: 'Advanced', value: 'Advanced' },
]

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
        {data.title || 'Simulation title will appear here'}
      </h3>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {data.industry && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {data.industry}
          </span>
        )}
        {data.discipline && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">
            {data.discipline}
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

export default function NewSimulationPage() {
  const router = useRouter()
  const slugManuallyEdited = useRef(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
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

  const watchedTitle = watch('title')
  const watchedSlug = watch('slug')
  const watchedAll = watch()
  const descLen = (watchedAll.description ?? '').length

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited.current) {
      const generated = slugify(watchedTitle ?? '')
      setValue('slug', generated, { shouldDirty: false })
      setSlugStatus('idle')
    }
  }, [watchedTitle, setValue])

  async function checkSlug(value: string) {
    if (!value || value.length < 2) { setSlugStatus('idle'); return }
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    setSlugStatus('checking')
    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/simulations/check-slug?slug=${encodeURIComponent(value)}`)
        const { available } = await res.json()
        setSlugStatus(available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 300)
  }

  const onSubmit = async (data: SimulationMeta) => {
    const res = await fetch('/api/admin/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      const created = await res.json()
      toast.success('Simulation created')
      router.push(`/admin/simulations/${created.slug}`)
    } else {
      const json = await res.json()
      if (json.fieldErrors) {
        Object.entries(json.fieldErrors as Record<string, string[]>).forEach(([key, msgs]) => {
          setError(key as keyof SimulationMeta, { message: msgs[0] })
        })
        toast.error('Please fix the highlighted fields')
      } else {
        toast.error('Failed to create simulation')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/simulations"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-semibold text-slate-900">New simulation</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-12 gap-6">
          {/* ── Form ── */}
          <div className="col-span-12 lg:col-span-8 space-y-5">
            <div className="bg-white rounded-xl p-6 space-y-5 border border-slate-200">

              {/* Status */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 text-sm font-medium">Status</label>
                <div className="flex gap-2">
                  {(['draft', 'published', 'archived'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setValue('status', s, { shouldDirty: true })}
                      className={cn(
                        'flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors capitalize',
                        watchedAll.status === s
                          ? s === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-400'
                            : s === 'archived'
                            ? 'bg-amber-50 text-amber-700 border-amber-400'
                            : 'bg-slate-100 text-slate-700 border-slate-400'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <Input
                id="title"
                label="Title"
                placeholder="e.g. Product Launch Strategy"
                error={errors.title?.message}
                {...register('title')}
              />

              {/* Company */}
              <Input
                id="company"
                label="Company"
                placeholder="e.g. Acme Corp"
                error={errors.company?.message}
                {...register('company')}
              />

              {/* Industry / Type */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="industry"
                  label="Industry"
                  placeholder="e.g. SaaS"
                  error={errors.industry?.message}
                  {...register('industry')}
                />
                <Input
                  id="type"
                  label="Type"
                  placeholder="e.g. Strategy, Analysis…"
                  error={errors.type?.message}
                  {...register('type')}
                />
              </div>

              {/* Difficulty */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 text-sm font-medium">Difficulty</label>
                <SegmentedControl
                  options={DIFFICULTY_OPTIONS}
                  value={watchedAll.difficulty ?? 'Foundation'}
                  onChange={v => setValue('difficulty', v as SimulationMeta['difficulty'], { shouldValidate: true, shouldDirty: true })}
                />
                {errors.difficulty && (
                  <p className="text-red-600 text-sm">{errors.difficulty.message}</p>
                )}
              </div>

              {/* Time */}
              <Input
                id="time"
                label="Time"
                placeholder="e.g. 45 min"
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
                  placeholder="Brief description visible on the public listing…"
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

              {/* Discipline / Video URL */}
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
                  label="Explainer Video URL"
                  type="url"
                  placeholder="https://…"
                  error={errors.video_url?.message}
                  {...register('video_url')}
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="slug" className="text-slate-900 text-sm font-medium">
                  Slug
                </label>
                <div className="relative">
                  <input
                    id="slug"
                    type="text"
                    placeholder="url-safe-identifier"
                    className={cn(
                      'w-full bg-white text-slate-900 rounded-md px-3 py-2 pr-8 border border-slate-300 text-sm',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 placeholder:text-slate-400',
                      errors.slug && 'border-red-500',
                      slugStatus === 'available' && 'border-emerald-500',
                      slugStatus === 'taken' && 'border-red-500'
                    )}
                    {...register('slug', {
                      onChange: () => { slugManuallyEdited.current = true; setSlugStatus('idle') },
                    })}
                    onBlur={e => { checkSlug(e.target.value) }}
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

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/admin/simulations')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || slugStatus === 'taken'}
              >
                {isSubmitting ? 'Creating…' : 'Create simulation'}
              </Button>
            </div>
          </div>

          {/* ── Live preview ── */}
          <div className="col-span-12 lg:col-span-4">
            <div className="sticky top-6 space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                Public preview
              </p>
              <SimPreview data={watchedAll} />
              <p className="text-xs text-slate-400 leading-relaxed">
                This is how the simulation will appear on the public listing page.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

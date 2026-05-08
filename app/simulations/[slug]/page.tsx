'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SimulationContent } from '@/lib/schemas/simulation'

// ── Preview banner ─────────────────────────────────────────────────────────────
function PreviewBanner({ hasDraft, slug }: { hasDraft: boolean; slug: string }) {
  const router = useRouter()
  function exitPreview() {
    router.replace(`/simulations/${slug}`)
  }
  return (
    <div
      className="w-full flex items-center justify-between px-6 py-2.5 text-sm font-medium"
      style={{
        backgroundColor: 'rgba(76,110,245,0.12)',
        borderBottom: '1px solid rgba(76,110,245,0.25)',
        color: '#a5b4fc',
      }}
    >
      <span>
        {hasDraft
          ? 'Preview mode — showing unsaved changes'
          : 'Preview mode — no draft found, showing saved version'}
      </span>
      <button
        onClick={exitPreview}
        className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        Exit preview
      </button>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-6 animate-pulse">
      <div className="h-6 w-64 rounded bg-white/[0.06]" />
      <div className="h-4 w-40 rounded bg-white/[0.04]" />
      <div className="h-px bg-white/[0.06]" />
      <div className="space-y-3">
        {[80, 100, 60, 90].map((w, i) => (
          <div key={i} className="h-4 rounded bg-white/[0.04]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── Prompt card ────────────────────────────────────────────────────────────────
function PromptCard({ prompt, index }: { prompt: SimulationContent['prompts'][number]; index: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: 'rgba(76,110,245,0.15)', color: '#818cf8', border: '1px solid rgba(76,110,245,0.25)' }}
        >
          {index + 1}
        </span>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest font-medium">
            {prompt.type === 'url' ? 'URL' : prompt.type === 'typed' ? 'Written' : 'Either'}
          </p>
          <h3 className="text-sm font-semibold text-white/90">{prompt.title}</h3>
        </div>
      </div>
      <p className="text-sm text-white/65 leading-relaxed">{prompt.question}</p>
      {prompt.guidance.length > 0 && (
        <ul className="space-y-1">
          {prompt.guidance.map((g, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/45">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
              {g}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-white/30">Min words: {prompt.minWords}</p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
type SimRow = {
  id: string
  slug: string
  title: string
  company: string
  industry: string
  difficulty: string
  time: string
  description: string
  sim_role: string | null
  brief_short: string | null
  brief_full: string | null
  video_transcript: string | null
  time_remaining: number[]
  prompts: SimulationContent['prompts']
}

export default function SimulationPreviewPage() {
  const { slug } = useParams() as { slug: string }
  const searchParams = useSearchParams()
  const isDraft = searchParams.get('draft') === '1'

  const [sim, setSim] = useState<SimRow | null>(null)
  const [draftContent, setDraftContent] = useState<SimulationContent | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // Load draft from sessionStorage if ?draft=1
    if (isDraft) {
      try {
        const raw = sessionStorage.getItem(`sim-draft:${slug}`)
        if (raw) {
          setDraftContent(JSON.parse(raw) as SimulationContent)
          setHasDraft(true)
        }
      } catch {
        // sessionStorage unavailable or JSON parse error
      }
    }

    // Always load saved version from DB
    const supabase = createClient()
    supabase
      .from('simulations')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          setSim(data as SimRow)
        }
        setLoading(false)
      })
  }, [slug, isDraft])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0f1112' }}>
        {isDraft && <PreviewBanner hasDraft={false} slug={slug} />}
        <PageSkeleton />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1112' }}>
        <div className="text-center space-y-3">
          <p className="text-white/40 text-sm">Simulation not found.</p>
        </div>
      </div>
    )
  }

  if (!sim) return null

  // Use draft content if available, otherwise fall back to DB
  const content = hasDraft && draftContent
    ? { ...sim, ...draftContent }
    : sim

  const prompts = content.prompts ?? []

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f1112' }}>
      {isDraft && <PreviewBanner hasDraft={hasDraft} slug={slug} />}

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white/40 uppercase tracking-widest font-medium">
              {sim.company}
            </span>
            <span className="text-white/15">·</span>
            <span className="text-xs text-white/40">{sim.industry}</span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-snug">{sim.title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">
              {sim.difficulty}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-white/50">
              {sim.time}
            </span>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Role */}
        {content.sim_role && (
          <div className="space-y-2">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium">Your role</h2>
            <p className="text-sm text-white/70 leading-relaxed">{content.sim_role}</p>
          </div>
        )}

        {/* Brief */}
        {content.brief_short && (
          <div className="space-y-2">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium">Brief</h2>
            <p className="text-sm text-white/70 leading-relaxed">{content.brief_short}</p>
          </div>
        )}

        {content.brief_full && (
          <div className="space-y-2">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium">Full brief</h2>
            <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{content.brief_full}</p>
          </div>
        )}

        {/* Prompts */}
        {prompts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium">
              Tasks ({prompts.length})
            </h2>
            {prompts.map((p, i) => (
              <PromptCard key={p.id} prompt={p} index={i} />
            ))}
          </div>
        )}

        {/* Description */}
        {sim.description && (
          <div className="space-y-2">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-medium">About</h2>
            <p className="text-sm text-white/55 leading-relaxed">{sim.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

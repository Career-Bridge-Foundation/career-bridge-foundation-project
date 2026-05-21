'use client'

import React, { useEffect } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { SimulationContent } from '@/lib/schemas/simulation'
import { EditorHeader } from './_header'
import { EditorTabs } from './_tabs'
import { OverviewTab } from './_overview'
import { PromptsTab } from './_prompts'
import { SettingsTab } from './_settings'
import { RubricTab } from './_rubric'
import { PreviewTab } from './_preview'
import { useBeforeUnload } from './_hooks/use-before-unload'
import { useKeyboardShortcuts } from './_hooks/use-keyboard-shortcuts'

interface ContentEditorProps {
  slug: string
  videoUrl?: string | null
  initialData: {
    id: number | string
    title: string
    sim_role: string | null
    brief_short: string | null
    brief_full: string | null
    video_transcript: string | null
    time_remaining: number[]
    prompts: Array<{
      id: number
      type: 'typed' | 'url' | 'either'
      title: string
      question: string
      guidance: string[]
      minWords: number
    }>
  }
}

export function ContentEditor({ slug, videoUrl, initialData }: ContentEditorProps) {
  const { setOriginal, activeTab, content } = useEditorStore()

  // Initialize store with data
  useEffect(() => {
    const data: SimulationContent = {
      id: String(initialData.id),
      sim_role: initialData.sim_role,
      brief_short: initialData.brief_short,
      brief_full: initialData.brief_full,
      video_transcript: initialData.video_transcript,
      time_remaining: initialData.time_remaining || [],
      prompts: (initialData.prompts || []).map((prompt) => ({
        ...prompt,
        id: String(prompt.id),
      })),
    }
    setOriginal(data)
  }, [initialData, setOriginal])

  // Prevent accidental navigation when dirty
  useBeforeUnload()

  // Setup keyboard shortcuts (Cmd/Ctrl+S)
  useKeyboardShortcuts(slug)

  if (!content) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-sm text-slate-400">Loading editor…</p>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <EditorHeader slug={slug} title={initialData.title} />
      <EditorTabs />
      <div className="flex-1">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'settings' && <SettingsTab slug={slug} />}
        {activeTab === 'rubric' && <RubricTab slug={slug} />}
        {activeTab === 'preview' && <PreviewTab videoUrl={videoUrl} />}
      </div>
    </div>
  )
}

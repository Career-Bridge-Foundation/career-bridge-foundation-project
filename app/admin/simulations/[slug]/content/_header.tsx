'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { SimulationContentSchema } from '@/lib/schemas/simulation'
import { normalizeSimulationContent } from '@/lib/simulation-content-utils'
import { Button } from '@/components/ui'
import { ArrowLeft, Save, Eye, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface EditorHeaderProps {
  slug: string
  title: string
}

export function EditorHeader({ slug, title }: EditorHeaderProps) {
  const { isDirty, saveStatus, setSaveStatus, setErrorMessage, content } = useEditorStore()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!content || !isDirty) return
    setSaveStatus('saving')
    setErrorMessage(null)
    setIsSaving(true)
    try {
      const validated = SimulationContentSchema.parse(normalizeSimulationContent(content))
      const response = await fetch(`/api/admin/simulations/${slug}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }
      setSaveStatus('saved')
      toast.success('Content saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      const error = err as Error
      setSaveStatus('error')
      setErrorMessage(error.message)
      toast.error(`Save failed: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  function handlePreview() {
    if (!content) return
    try {
      sessionStorage.setItem(`sim-draft:${slug}`, JSON.stringify(content))
    } catch {
      // sessionStorage unavailable — open anyway without draft
    }
    window.open(`/simulations/${slug}?draft=1`, '_blank', 'noopener')
  }

  return (
    <div
      className="sticky top-0 z-40 bg-white border-b px-6 py-3"
      style={{ borderColor: '#d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: back + breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/admin/simulations/${slug}`}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 transition-colors shrink-0"
            style={{ color: 'rgba(0,51,89,0.5)' }}
            aria-label="Back to simulation"
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate" style={{ color: '#003359' }}>{title}</h1>
            <p className="text-xs font-mono" style={{ color: 'rgba(0,51,89,0.4)' }}>{slug}</p>
          </div>
        </div>

        {/* Right: save status + actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Save status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={12} className="animate-spin" style={{ color: '#0d9488' }} />
                <span style={{ color: '#0d9488' }}>Saving…</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                <span style={{ color: '#16a34a' }}>Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle size={12} style={{ color: '#e11d48' }} />
                <span style={{ color: '#e11d48' }}>Error saving</span>
              </>
            )}
            {saveStatus === 'idle' && isDirty && (
              <span style={{ color: 'rgba(0,51,89,0.4)' }}>Unsaved changes</span>
            )}
            {saveStatus === 'idle' && !isDirty && (
              <span style={{ color: 'rgba(0,51,89,0.3)' }}>All saved</span>
            )}
          </div>

          <Button onClick={handlePreview} variant="secondary" size="sm" leftIcon={<Eye size={13} />}>
            Preview
          </Button>

          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            variant="primary"
            size="sm"
            leftIcon={<Save size={13} />}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { SimulationContentSchema } from '@/lib/schemas/simulation'
import { Button } from '@/components/ui'
import { ArrowLeft, Save, Eye } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
      const validated = SimulationContentSchema.parse(content)
      const payload = {
        ...validated,
        prompts: validated.prompts.map((p, i) => ({ ...p, id: i + 1 })),
      }

      const response = await fetch(`/api/admin/simulations/${slug}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="sticky top-0 z-40 bg-slate-900/10 backdrop-blur-sm border-b border-border px-8 py-4 mb-6 rounded-b-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/simulations"
            className="text-slate-500/60 hover:text-slate-900 transition-colors"
            aria-label="Back to simulations"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-800/50 font-mono">{slug}</p>
          </div>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-3">
          <motion.div
            key={saveStatus}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`text-sm px-3 py-1.5 rounded-full flex items-center gap-2 ${
              saveStatus === 'error'
                ? 'bg-red-950/40 text-red-300 border border-red-900/50'
                : saveStatus === 'saving'
                ? 'bg-accent/20 text-accent border border-accent/30'
                : saveStatus === 'saved'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/50'
                : isDirty
                ? 'bg-white/10 text-slate-700/70 border border-white/20'
                : 'bg-white/5 text-slate-700/50 border border-white/10'
            }`}
          >
            {saveStatus === 'saving' && (
              <>
                <div className="inline-block animate-spin">●</div>
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <span>✓</span>
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <span>⚠</span>
                <span>Error</span>
              </>
            )}
            {isDirty && saveStatus !== 'saving' && saveStatus !== 'saved' && (
              <span>Unsaved changes</span>
            )}
            {!isDirty && saveStatus === 'idle' && <span>All saved</span>}
          </motion.div>

          <Button
            onClick={handlePreview}
            variant="secondary"
            size="sm"
            leftIcon={<Eye size={14} />}
          >
            Preview
          </Button>

          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            variant="primary"
            size="sm"
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

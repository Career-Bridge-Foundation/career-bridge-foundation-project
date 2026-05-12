'use client'

import { useEffect, useCallback } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { SimulationContentSchema } from '@/lib/schemas/simulation'
import { normalizeSimulationContent } from '@/lib/simulation-content-utils'
import { toast } from 'sonner'

export function useKeyboardShortcuts(slug: string) {
  const { content, isDirty, setSaveStatus, setErrorMessage } = useEditorStore()

  const save = useCallback(async () => {
    if (!content || !isDirty) return

    setSaveStatus('saving')
    setErrorMessage(null)

    try {
      // Validate content
      const validated = SimulationContentSchema.parse(normalizeSimulationContent(content))

      // Resequence ids
      const payload = validated

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
      toast.success('Content saved successfully')
      
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      const error = err as Error
      setSaveStatus('error')
      setErrorMessage(error.message)
      toast.error(`Save failed: ${error.message}`)
      
      console.error('Save error:', error)
    }
  }, [content, isDirty, slug, setSaveStatus, setErrorMessage])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save])
}

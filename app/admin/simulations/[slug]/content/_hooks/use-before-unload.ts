'use client'

import { useEffect } from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'

export function useBeforeUnload() {
  const { isDirty } = useEditorStore()

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}

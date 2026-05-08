'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CommandPalette } from '@/components/ui'

type SimSlim = { slug: string; title: string; company: string }

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sims, setSims] = useState<SimSlim[]>([])

  const toggle = useCallback(() => setOpen(v => !v), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])

  // Lazy-load simulations when palette opens
  useEffect(() => {
    if (open && sims.length === 0) {
      fetch('/api/admin/simulations')
        .then(r => r.ok ? r.json() : [])
        .then(data => setSims(data as SimSlim[]))
        .catch(() => {})
    }
  }, [open, sims.length])

  return (
    <>
      {children}
      <CommandPalette open={open} onClose={() => setOpen(false)} simulations={sims} />
    </>
  )
}

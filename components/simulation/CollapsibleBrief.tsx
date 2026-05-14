'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  brief: string
}

export default function CollapsibleBrief({ brief }: Props) {
  const [open, setOpen] = useState(false)
  const paragraphs = brief.split('\n\n').filter(Boolean)

  return (
    <div className="rounded-lg border border-border bg-surface-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-text-primary">Scenario Brief</span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          {open ? 'Hide' : 'Show'}
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm text-text-primary leading-relaxed">
              {paragraph}
            </p>
          ))}
          <p className="text-xs text-text-muted border-l-2 border-brand-accent pl-3 mt-4">
            This brief is available throughout the simulation for reference.
          </p>
        </div>
      )}
    </div>
  )
}

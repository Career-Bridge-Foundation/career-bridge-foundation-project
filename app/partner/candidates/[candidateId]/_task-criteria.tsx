'use client'
import { useState } from 'react'

type Criterion = { taskId: number; name: string; level: string; score: number; feedback: string }

// Reuses the console tonal language (teal/amber/red) — no new color system.
const LEVEL_STYLE: Record<string, string> = {
  Strong: 'bg-teal/10 text-teal border-teal/30',
  Competent: 'bg-amber-50 text-amber-700 border-amber-200',
  Weak: 'bg-red-50 text-red-700 border-red-200',
}

export function TaskCriteria({ criteria }: { criteria: Criterion[] }) {
  const [open, setOpen] = useState(false)
  if (criteria.length === 0) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-teal hover:underline">
        {open ? 'Hide' : 'Show'} {criteria.length} criteria
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {criteria.map((c, i) => (
            <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{c.name}</p>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[c.level] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>{c.level || '—'}</span>
                  <span className="text-xs text-slate-500">{c.score} / 3</span>
                </span>
              </div>
              {c.feedback && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.feedback}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

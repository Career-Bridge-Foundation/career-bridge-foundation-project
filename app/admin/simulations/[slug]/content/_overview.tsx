'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { cn } from '@/lib/cn'

const FIELD_CLASS = cn(
  'w-full bg-white text-slate-900 text-sm rounded-md px-3 py-2',
  'border border-slate-300 placeholder:text-slate-400 resize-none',
  'focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all'
)

function FieldSection({
  label,
  charCount,
  children,
}: {
  label: string
  charCount?: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-900">{label}</label>
        {charCount !== undefined && (
          <span className={cn('text-xs', charCount > 0 ? 'text-slate-400' : 'text-slate-300')}>
            {charCount} chars
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export function OverviewTab() {
  const { content, updateContent } = useEditorStore()
  if (!content) return null

  const briefShortLen = content.brief_short?.length ?? 0
  const briefFullLen  = content.brief_full?.length ?? 0
  const videoLen      = content.video_transcript?.length ?? 0

  function handleTimeChange(index: number, value: string) {
    if (!content) return
    const newTimes = [...content.time_remaining]
    newTimes[index] = Math.max(0, parseInt(value) || 0)
    updateContent({ time_remaining: newTimes })
  }

  const totalTime = content.time_remaining.reduce((a, b) => a + b, 0)
  const maxTime   = Math.max(...content.time_remaining, 1)

  return (
    <div className="space-y-5 max-w-4xl mx-auto px-6 py-6">
      {/* Briefs */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: '#d5dce8' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Briefs</h3>
        </div>
        <div className="px-6 py-5 space-y-5">
          <FieldSection label="Short Brief" charCount={briefShortLen}>
            <textarea
              rows={3}
              value={content.brief_short ?? ''}
              onChange={e => updateContent({ brief_short: e.target.value })}
              placeholder="Brief overview of the scenario…"
              className={FIELD_CLASS}
            />
          </FieldSection>
          <FieldSection label="Full Brief" charCount={briefFullLen}>
            <textarea
              rows={6}
              value={content.brief_full ?? ''}
              onChange={e => updateContent({ brief_full: e.target.value })}
              placeholder="Detailed scenario background…"
              className={FIELD_CLASS}
            />
          </FieldSection>
        </div>
      </div>

      {/* Video Transcript */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: '#d5dce8' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Video Transcript</h3>
        </div>
        <div className="px-6 py-5">
          <FieldSection label="" charCount={videoLen}>
            <textarea
              rows={7}
              value={content.video_transcript ?? ''}
              onChange={e => updateContent({ video_transcript: e.target.value })}
              placeholder="Full video transcript…"
              className={FIELD_CLASS}
            />
          </FieldSection>
        </div>
      </div>

      {/* Step Timing */}
      {content.time_remaining.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: '#d5dce8' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Step Timing</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            {content.time_remaining.map((time, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5 truncate">
                    Step {idx + 1}
                    {content.prompts[idx]?.title && (
                      <span className="font-normal text-slate-400 ml-1">— {content.prompts[idx].title}</span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={time}
                      onChange={e => handleTimeChange(idx, e.target.value)}
                      className="w-24 bg-white text-slate-900 text-sm rounded-md px-3 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                    />
                    <span className="text-xs text-slate-400">min</span>
                    {/* Visual bar */}
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,51,89,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, Math.round((time / maxTime) * 100))}%`,
                          backgroundColor: '#0d9488',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right" style={{ color: '#003359' }}>{time}m</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">Total time</span>
              <span className="text-sm font-semibold" style={{ color: '#003359' }}>{totalTime} min</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

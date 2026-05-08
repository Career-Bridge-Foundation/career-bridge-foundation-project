'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { Card } from '@/components/ui'

export function OverviewTab() {
  const { content, updateContent } = useEditorStore()

  if (!content) return null

  const handleBriefShortChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent({ brief_short: e.target.value })
  }

  const handleBriefFullChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent({ brief_full: e.target.value })
  }

  const handleVideoTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent({ video_transcript: e.target.value })
  }

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...content.time_remaining]
    newTimes[index] = Math.max(0, parseInt(value) || 0)
    updateContent({ time_remaining: newTimes })
  }

  const briefShortLength = content.brief_short?.length || 0
  const briefFullLength = content.brief_full?.length || 0
  const videoLength = content.video_transcript?.length || 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-8">
      {/* Briefs */}
      <Card>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Short Brief</h3>
            <textarea
              value={content.brief_short || ''}
              onChange={handleBriefShortChange}
              placeholder="Brief overview of the scenario..."
              className="w-full h-24 bg-gray-200 border border-border rounded-lg px-4 py-3 text-slate-700 placeholder:text-slate-700/30 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <div className="text-xs text-slate-700/50 mt-2">
              {briefShortLength} characters
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Full Brief</h3>
            <textarea
              value={content.brief_full || ''}
              onChange={handleBriefFullChange}
              placeholder="Detailed scenario background..."
              className="w-full h-32 bg-gray-200 border border-border rounded-lg px-4 py-3 text-slate-700 placeholder:text-slate-700/30 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <div className="text-xs text-slate-700/50 mt-2">
              {briefFullLength} characters
            </div>
          </div>
        </div>
      </Card>

      {/* Video Transcript */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Video Transcript</h3>
          <textarea
            value={content.video_transcript || ''}
            onChange={handleVideoTranscriptChange}
            placeholder="Full video transcript..."
            className="w-full h-40 bg-gray-200 border border-border rounded-lg px-4 py-3 text-slate-700 placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="text-xs text-slate-700/50">
            {videoLength} characters
          </div>
        </div>
      </Card>

      {/* Step Timing */}
      <Card>
        <div className="p-6 space-y-6">
          <h3 className="text-sm font-semibold text-slate-700">Step Timing</h3>
          
          <div className="space-y-4">
            {content.time_remaining.map((time, idx) => (
              <div key={idx} className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs text-slate-700/70 font-medium">
                    Step {idx + 1}: {content.prompts[idx]?.title || 'Prompt'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={time}
                    onChange={(e) => handleTimeChange(idx, e.target.value)}
                    className="w-full bg-gray-200 border border-border rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                
                {/* Mini bar chart */}
                <div className="flex-shrink-0 flex items-end gap-1 h-10">
                  <div
                    className="w-8 bg-gradient-to-t from-accent to-accent/60 rounded-sm transition-all"
                    style={{
                      height: `${Math.max(4, (time / Math.max(...content.time_remaining, 30)) * 40)}px`,
                    }}
                    title={`${time}min`}
                  />
                </div>
                
                <span className="text-xs text-slate-700/50 w-8 text-right">
                  {time}m
                </span>
              </div>
            ))}
          </div>

          {/* Total time */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-slate-700/60">
              Total time: <span className="text-slate-700 font-semibold">
                {content.time_remaining.reduce((a, b) => a + b, 0)} minutes
              </span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

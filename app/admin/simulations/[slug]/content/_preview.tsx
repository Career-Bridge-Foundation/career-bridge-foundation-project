'use client'

import React from 'react'
import { useEditorStore } from '@/lib/stores/simulation-editor'
import { FileText, User, PlayCircle, AlignLeft, ChevronRight } from 'lucide-react'

function getEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v')
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    if (u.hostname.includes('loom.com')) {
      return url.replace('/share/', '/embed/')
    }
  } catch {
    // invalid URL — fall through
  }
  return null
}

interface PreviewTabProps {
  videoUrl?: string | null
}

export function PreviewTab({ videoUrl }: PreviewTabProps) {
  const { content } = useEditorStore()
  if (!content) return null

  const embedUrl = getEmbedUrl(videoUrl)
  const hasContent =
    !!content.sim_role ||
    !!content.brief_short ||
    !!content.brief_full ||
    content.prompts.length > 0 ||
    !!content.video_transcript

  return (
    <div className="space-y-5 max-w-4xl mx-auto px-6 py-6">
      {/* Role banner */}
      {content.sim_role && (
        <div
          className="rounded-xl px-6 py-4 flex items-center gap-3"
          style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}
        >
          <User size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#0284c7' }}>
              Your Role
            </div>
            <div className="text-sm font-medium" style={{ color: '#003359' }}>{content.sim_role}</div>
          </div>
        </div>
      )}

      {/* Briefing video */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: '#d5dce8' }}>
          <PlayCircle size={14} style={{ color: '#0d9488' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Briefing Video</h3>
        </div>
        <div className="px-6 py-5">
          {embedUrl ? (
            <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={embedUrl}
                title="Briefing video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-lg h-36"
              style={{ backgroundColor: '#f8fafc', border: '1px dashed #d5dce8' }}
            >
              <p className="text-xs" style={{ color: 'rgba(0,51,89,0.35)' }}>
                {videoUrl ? 'Unable to embed this video URL' : 'No video URL set — add one in Settings'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scenario brief */}
      {(content.brief_short || content.brief_full) && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: '#d5dce8' }}>
            <AlignLeft size={14} style={{ color: '#0d9488' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Scenario Brief</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            {content.brief_short && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(0,51,89,0.4)' }}>
                  Overview
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#003359' }}>{content.brief_short}</p>
              </div>
            )}
            {content.brief_short && content.brief_full && (
              <div className="border-t" style={{ borderColor: '#f1f5f9' }} />
            )}
            {content.brief_full && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(0,51,89,0.4)' }}>
                  Full Background
                </div>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'rgba(0,51,89,0.8)' }}
                >
                  {content.brief_full}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompts */}
      {content.prompts.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: '#d5dce8' }}>
            <FileText size={14} style={{ color: '#0d9488' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>
              Prompts
              <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(0,51,89,0.4)' }}>
                {content.prompts.length} step{content.prompts.length !== 1 ? 's' : ''}
              </span>
            </h3>
          </div>
          <div>
            {content.prompts.map((prompt, idx) => (
              <div
                key={prompt.id}
                className="px-6 py-4"
                style={{ borderBottom: idx < content.prompts.length - 1 ? '1px solid #f1f5f9' : undefined }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ backgroundColor: 'rgba(13,148,136,0.1)', color: '#0d9488' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: '#003359' }}>{prompt.title}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
                      >
                        {prompt.type}
                      </span>
                      {content.time_remaining[idx] !== undefined && content.time_remaining[idx] > 0 && (
                        <span className="text-xs" style={{ color: 'rgba(0,51,89,0.4)' }}>
                          {content.time_remaining[idx]}m
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,51,89,0.75)' }}>{prompt.question}</p>
                    {prompt.guidance.length > 0 && (
                      <ul className="mt-2.5 space-y-1">
                        {prompt.guidance.map((g, gi) => (
                          <li key={gi} className="flex items-start gap-1.5 text-xs" style={{ color: 'rgba(0,51,89,0.55)' }}>
                            <ChevronRight size={11} className="mt-0.5 shrink-0" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    )}
                    {prompt.minWords > 0 && (
                      <div className="mt-2 text-xs" style={{ color: 'rgba(0,51,89,0.4)' }}>
                        Minimum {prompt.minWords} words
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video transcript */}
      {content.video_transcript && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #d5dce8', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: '#d5dce8' }}>
            <AlignLeft size={14} style={{ color: '#0d9488' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#003359' }}>Video Transcript</h3>
          </div>
          <div className="px-6 py-5">
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'rgba(0,51,89,0.7)' }}
            >
              {content.video_transcript}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ backgroundColor: '#fff', border: '1px dashed #d5dce8' }}
        >
          <FileText size={24} className="mb-3" style={{ color: 'rgba(0,51,89,0.2)' }} />
          <p className="text-sm" style={{ color: 'rgba(0,51,89,0.4)' }}>No content to preview yet</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(0,51,89,0.3)' }}>
            Add content in the Overview, Prompts, and Settings tabs
          </p>
        </div>
      )}
    </div>
  )
}

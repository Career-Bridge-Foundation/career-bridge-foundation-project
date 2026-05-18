'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquarePlus, X, Trash2, Video, ChevronDown, ChevronUp, Clock } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimComment {
  id: string
  reviewer_id: string
  reviewer_label: string | null
  section_key: string
  selected_text: string
  comment: string
  created_at: string
  timestamp_seconds: number | null
}

interface Prompt {
  id: string
  type: string
  title: string
  question: string
  guidance: string[]
  minWords: number
}

interface Rubric {
  id: string
  version: number
  system_prompt: string
  model: string
  max_score: number
}

interface Props {
  slug: string
  reviewerId: string
  videoUrl?: string | null
  videoTranscript?: string | null
  brief?: string | null
  prompts: Prompt[]
  rubric: Rubric | null
}

const REVIEWER_LABEL_KEY = 'cb_reviewer_label'

interface ActiveSelection {
  text: string
  sectionKey: string
  btnX: number
  btnY: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function detectVideoType(url: string): 'youtube' | 'vimeo' | 'loom' | 'native' {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/vimeo\.com/.test(url)) return 'vimeo'
  if (/loom\.com/.test(url)) return 'loom'
  return 'native'
}

function getEmbedUrl(url: string, type: 'youtube' | 'vimeo' | 'loom'): string {
  if (type === 'youtube') {
    const m = url.match(/(?:v=|youtu\.be\/)([^&\s?]+)/)
    return m ? `https://www.youtube.com/embed/${m[1]}` : url
  }
  if (type === 'vimeo') {
    const m = url.match(/vimeo\.com\/(\d+)/)
    return m ? `https://player.vimeo.com/video/${m[1]}` : url
  }
  if (type === 'loom') {
    const m = url.match(/loom\.com\/share\/([^?\s]+)/)
    return m ? `https://www.loom.com/embed/${m[1]}` : url
  }
  return url
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommentablePage({ slug, reviewerId, videoUrl, videoTranscript, brief, prompts, rubric }: Props) {
  const [comments, setComments] = useState<SimComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)

  // Text-selection state
  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formComment, setFormComment] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Video comment state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoCommentOpen, setVideoCommentOpen] = useState(false)
  const [videoTimestamp, setVideoTimestamp] = useState(0)
  const [videoComment, setVideoComment] = useState('')
  const [videoSubmitting, setVideoSubmitting] = useState(false)
  const [videoCommentError, setVideoCommentError] = useState<string | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const videoCommentRef = useRef<HTMLTextAreaElement>(null)

  // ── Load all comments ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/reviewer/simulations/${slug}/comments`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setComments(data.comments ?? []))
      .catch(() => {})
      .finally(() => setLoadingComments(false))
  }, [slug])

  // ── Restore saved reviewer label ──────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REVIEWER_LABEL_KEY)
      if (saved) setFormLabel(saved)
    } catch {}
  }, [])

  // ── Text selection handler ────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isFormOpen || videoCommentOpen) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) { setActiveSelection(null); return }

      const text = sel.toString().trim()
      if (text.length < 3) { setActiveSelection(null); return }

      const range = sel.getRangeAt(0)
      const ancestor = range.commonAncestorContainer
      const el = ancestor instanceof Element ? ancestor : ancestor.parentElement
      const sectionEl = el?.closest<HTMLElement>('[data-section]')
      if (!sectionEl) return

      const sectionKey = sectionEl.dataset.section ?? ''
      const rect = range.getBoundingClientRect()
      setActiveSelection({ text, sectionKey, btnX: rect.left + rect.width / 2, btnY: rect.bottom })
    },
    [isFormOpen, videoCommentOpen],
  )

  function openForm() {
    setIsFormOpen(true)
    setFormComment('')
    setFormError(null)
    setTimeout(() => commentTextareaRef.current?.focus(), 50)
  }

  function closeForm() {
    setIsFormOpen(false)
    setActiveSelection(null)
    setFormComment('')
    setFormError(null)
  }

  async function submitComment() {
    if (!activeSelection || !formComment.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      if (formLabel.trim()) localStorage.setItem(REVIEWER_LABEL_KEY, formLabel.trim())
      else localStorage.removeItem(REVIEWER_LABEL_KEY)
    } catch {}
    try {
      const res = await fetch(`/api/reviewer/simulations/${slug}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key:   activeSelection.sectionKey,
          selected_text: activeSelection.text,
          comment:       formComment.trim(),
          reviewer_label: formLabel.trim() || null,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Something went wrong') }
      const { comment } = await res.json()
      setComments(prev => [...prev, comment])
      closeForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Video comment handlers ─────────────────────────────────────────────────

  function openVideoComment() {
    const ts = videoRef.current?.currentTime ?? 0
    setVideoTimestamp(ts)
    setVideoComment('')
    setVideoCommentError(null)
    setVideoCommentOpen(true)
    setTimeout(() => videoCommentRef.current?.focus(), 50)
  }

  function closeVideoComment() {
    setVideoCommentOpen(false)
    setVideoComment('')
    setVideoCommentError(null)
  }

  async function submitVideoComment() {
    if (!videoComment.trim()) return
    setVideoSubmitting(true)
    setVideoCommentError(null)
    try {
      if (formLabel.trim()) localStorage.setItem(REVIEWER_LABEL_KEY, formLabel.trim())
    } catch {}
    try {
      const res = await fetch(`/api/reviewer/simulations/${slug}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key:       'video',
          comment:           videoComment.trim(),
          reviewer_label:    formLabel.trim() || null,
          timestamp_seconds: videoTimestamp,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? 'Something went wrong') }
      const { comment } = await res.json()
      setComments(prev => [...prev, comment])
      closeVideoComment()
    } catch (err) {
      setVideoCommentError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setVideoSubmitting(false)
    }
  }

  function seekToTimestamp(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/reviewer/simulations/${slug}/comments/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
  }

  function sectionComments(key: string) {
    return comments.filter(c => c.section_key === key)
  }

  const videoComments = comments
    .filter(c => c.section_key === 'video')
    .sort((a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0))

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div onMouseUp={handleMouseUp}>

      {/* ── Video section ─────────────────────────────────────────────────── */}
      {videoUrl && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Video</h2>
            </div>
            <span className="text-xs text-slate-400 select-none">Pause and comment at any moment</span>
          </div>

          <div className="px-6 pt-5">
            <VideoPlayer videoUrl={videoUrl} videoRef={videoRef} />

            {/* Comment at current time */}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Pause the video at the moment you want to comment, then click the button.
              </p>
              <button
                onClick={openVideoComment}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-700 transition-colors shrink-0 ml-4"
              >
                <MessageSquarePlus size={13} />
                Comment at this moment
              </button>
            </div>

            {/* Transcript toggle */}
            {videoTranscript && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setTranscriptOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {transcriptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
                </button>
                {transcriptOpen && (
                  <pre className="mt-3 text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-md p-4 border border-slate-100 max-h-64 overflow-y-auto">
                    {videoTranscript}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Video comments timeline */}
          {(videoComments.length > 0 || loadingComments) && (
            <div className="px-6 py-4 border-t border-slate-100 mt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
                Comments ({videoComments.length})
              </p>
              {loadingComments ? null : (
                <div className="space-y-3">
                  {videoComments.map(c => (
                    <VideoCommentCard
                      key={c.id}
                      comment={c}
                      reviewerId={reviewerId}
                      onDelete={deleteComment}
                      onSeek={seekToTimestamp}
                      canSeek={!!videoRef.current}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="h-5" />
        </section>
      )}

      {/* ── Brief ─────────────────────────────────────────────────────────── */}
      {brief && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Brief</h2>
            <CommentHint />
          </div>
          <div className="px-6 py-5">
            <div data-section="brief" className="select-text">
              <p className="text-sm text-slate-700 leading-relaxed">{brief}</p>
            </div>
            <CommentList
              comments={sectionComments('brief')}
              reviewerId={reviewerId}
              loading={loadingComments}
              onDelete={deleteComment}
            />
          </div>
        </section>
      )}

      {/* ── Prompts ──────────────────────────────────────────────────────── */}
      {prompts.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Prompts ({prompts.length})</h2>
            <CommentHint />
          </div>
          <div className="divide-y divide-slate-100">
            {prompts.map((p, i) => {
              const key = `prompt-${p.id}`
              return (
                <div key={p.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-teal bg-teal/10 rounded px-2 py-0.5">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-900">{p.title}</span>
                  </div>
                  <div data-section={key} className="select-text">
                    <p className="text-sm text-slate-700 leading-relaxed">{p.question}</p>
                    {p.guidance.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.guidance.map((g, gi) => (
                          <li key={gi} className="text-xs text-slate-500 flex items-start gap-1.5">
                            <span className="mt-1 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.minWords > 0 && <p className="text-xs text-slate-400 mt-2">Min. {p.minWords} words</p>}
                  </div>
                  <CommentList
                    comments={sectionComments(key)}
                    reviewerId={reviewerId}
                    loading={loadingComments}
                    onDelete={deleteComment}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Rubric ───────────────────────────────────────────────────────── */}
      {rubric && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Rubric</h2>
            <span className="text-xs text-slate-400 flex items-center gap-3">
              <span>v{rubric.version} · {rubric.model} · max {rubric.max_score}</span>
              <CommentHint />
            </span>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">System prompt</p>
            <div data-section="rubric" className="select-text">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded-md p-4 border border-slate-100">
                {rubric.system_prompt}
              </pre>
            </div>
            <CommentList
              comments={sectionComments('rubric')}
              reviewerId={reviewerId}
              loading={loadingComments}
              onDelete={deleteComment}
            />
          </div>
        </section>
      )}

      {/* ── Floating "Add comment" button (text selection) ─────────────────── */}
      {activeSelection && !isFormOpen && (
        <div
          className="fixed z-40 flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-slate-700 transition-colors select-none"
          style={{ left: activeSelection.btnX, top: activeSelection.btnY + 8, transform: 'translateX(-50%)' }}
          onMouseDown={e => e.preventDefault()}
          onClick={openForm}
        >
          <MessageSquarePlus size={13} />
          Add comment
        </div>
      )}

      {/* ── Text selection comment modal ──────────────────────────────────── */}
      {isFormOpen && activeSelection && (
        <CommentModal
          title="Add comment"
          label={formLabel}
          onLabelChange={setFormLabel}
          comment={formComment}
          onCommentChange={setFormComment}
          error={formError}
          submitting={submitting}
          onClose={closeForm}
          onSubmit={submitComment}
          textareaRef={commentTextareaRef}
        >
          <div className="border-l-[3px] border-amber-400 pl-3 py-1 mb-5 bg-amber-50 rounded-r-md">
            <p className="text-xs text-slate-500 italic line-clamp-3">
              &ldquo;{activeSelection.text.length > 220 ? activeSelection.text.slice(0, 220) + '…' : activeSelection.text}&rdquo;
            </p>
          </div>
        </CommentModal>
      )}

      {/* ── Video comment modal ───────────────────────────────────────────── */}
      {videoCommentOpen && (
        <CommentModal
          title="Comment on video"
          label={formLabel}
          onLabelChange={setFormLabel}
          comment={videoComment}
          onCommentChange={setVideoComment}
          error={videoCommentError}
          submitting={videoSubmitting}
          onClose={closeVideoComment}
          onSubmit={submitVideoComment}
          textareaRef={videoCommentRef}
        >
          <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-slate-100 rounded-md">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span className="text-sm font-mono font-semibold text-slate-700">
              {formatTime(videoTimestamp)}
            </span>
            <span className="text-xs text-slate-400">— your comment will be anchored to this timestamp</span>
          </div>
        </CommentModal>
      )}
    </div>
  )
}

// ─── Video Player ─────────────────────────────────────────────────────────────

function VideoPlayer({ videoUrl, videoRef }: { videoUrl: string; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const type = detectVideoType(videoUrl)

  if (type === 'native') {
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full rounded-md bg-black max-h-[480px]"
        preload="metadata"
      />
    )
  }

  const embedUrl = getEmbedUrl(videoUrl, type)
  return (
    <div className="relative w-full rounded-md overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Simulation video"
      />
    </div>
  )
}

// ─── Comment modal (shared by text selection + video) ────────────────────────

interface CommentModalProps {
  title: string
  label: string
  onLabelChange: (v: string) => void
  comment: string
  onCommentChange: (v: string) => void
  error: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  children?: React.ReactNode
}

function CommentModal({
  title, label, onLabelChange, comment, onCommentChange,
  error, submitting, onClose, onSubmit, textareaRef, children,
}: CommentModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {children}

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Your name or initials <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => onLabelChange(e.target.value)}
            placeholder="e.g. J.D. or Jane"
            maxLength={60}
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Comment <span className="text-red-400">*</span>
          </label>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={e => onCommentChange(e.target.value)}
            placeholder="Share your feedback…"
            rows={4}
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit() }}
          />
          <p className="text-xs text-slate-400 mt-1">Cmd/Ctrl+Enter to submit</p>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!comment.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Video comment card ───────────────────────────────────────────────────────

function VideoCommentCard({
  comment, reviewerId, onDelete, onSeek, canSeek,
}: {
  comment: SimComment
  reviewerId: string
  onDelete: (id: string) => void
  onSeek: (seconds: number) => void
  canSeek: boolean
}) {
  return (
    <div className="group flex gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase select-none">
        {comment.reviewer_label ? comment.reviewer_label.slice(0, 2) : '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-800">{comment.reviewer_label || 'Anonymous'}</span>
          {comment.timestamp_seconds != null && (
            <button
              onClick={() => onSeek(comment.timestamp_seconds!)}
              className={`inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded bg-slate-900 text-white ${canSeek ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'} transition-colors`}
              title={canSeek ? 'Jump to this moment' : undefined}
            >
              <Clock size={10} />
              {formatTime(comment.timestamp_seconds)}
            </button>
          )}
          <span className="text-xs text-slate-400">
            {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
      </div>
      {comment.reviewer_id === reviewerId && (
        <button
          onClick={() => onDelete(comment.id)}
          className="shrink-0 self-start opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
          title="Delete comment"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ─── Text-selection comment list ──────────────────────────────────────────────

function CommentHint() {
  return (
    <span className="text-xs text-slate-400 select-none hidden sm:inline">Highlight text to comment</span>
  )
}

interface CommentListProps {
  comments: SimComment[]
  reviewerId: string
  loading: boolean
  onDelete: (id: string) => void
}

function CommentList({ comments, reviewerId, loading, onDelete }: CommentListProps) {
  if (loading || comments.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      {comments.map(c => (
        <div key={c.id} className="group flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="shrink-0 w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-800 uppercase select-none">
            {c.reviewer_label ? c.reviewer_label.slice(0, 2) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-800">{c.reviewer_label || 'Anonymous'}</span>
              <span className="text-xs text-slate-400">
                {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <blockquote className="border-l-[3px] border-amber-400 pl-2 mb-2">
              <p className="text-xs italic text-slate-500 line-clamp-2">&ldquo;{c.selected_text}&rdquo;</p>
            </blockquote>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.comment}</p>
          </div>
          {c.reviewer_id === reviewerId && (
            <button
              onClick={() => onDelete(c.id)}
              className="shrink-0 self-start opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
              title="Delete comment"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

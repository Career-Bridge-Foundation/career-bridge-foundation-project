'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { SimulationPrompt } from '@/types/simulation'

type Props = {
  simulationId: string
  prompt: SimulationPrompt
  step: number
  totalSteps: number
}

type Mode = 'typed' | 'file' | 'url'

type StoredResponse =
  | { mode: 'typed'; content: string }
  | { mode: 'file'; fileName: string; fileSize: number; base64: string }
  | { mode: 'url'; url: string; rationale: string }

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

function storageKey(simulationId: string) {
  return `cb_responses_${simulationId}`
}

function loadResponses(simulationId: string): Record<number, StoredResponse> {
  try {
    const raw = sessionStorage.getItem(storageKey(simulationId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveResponse(simulationId: string, step: number, response: StoredResponse) {
  const all = loadResponses(simulationId)
  all[step] = response
  sessionStorage.setItem(storageKey(simulationId), JSON.stringify(all))
}

export default function PromptForm({ simulationId, prompt, step, totalSteps }: Props) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('typed')
  const [typedContent, setTypedContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Available modes based on submission type
  const availableModes: Mode[] =
    prompt.submissionType === 'typed'
      ? ['typed']
      : prompt.submissionType === 'either'
        ? ['typed', 'file']
        : ['typed', 'file', 'url']

  // Restore saved typed/url response for this step
  useEffect(() => {
    const existing = loadResponses(simulationId)[step]
    if (!existing) return
    if (existing.mode === 'typed') {
      setMode('typed')
      setTypedContent(existing.content)
    } else if (existing.mode === 'url') {
      setMode('url')
      setUrl(existing.url)
      setRationale(existing.rationale)
    }
    // file mode: File object can't be restored from sessionStorage
  }, [simulationId, step])

  const typedWordCount = countWords(typedContent)
  const rationaleWordCount = countWords(rationale)

  function validate(): string | null {
    if (mode === 'typed') {
      if (typedWordCount < 50) return 'Please write at least 50 words before continuing.'
    } else if (mode === 'file') {
      if (!file) return 'Please select a file to upload.'
    } else if (mode === 'url') {
      if (!url.trim()) return 'Please enter a URL.'
      try {
        new URL(url.trim())
      } catch {
        return 'Please enter a valid URL (e.g. https://docs.google.com/…).'
      }
      if (rationaleWordCount < 50) return 'Please write at least 50 words in your rationale.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const err = validate()
    if (err) {
      setError(err)
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'typed') {
        saveResponse(simulationId, step, { mode: 'typed', content: typedContent })
      } else if (mode === 'file' && file) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        saveResponse(simulationId, step, {
          mode: 'file',
          fileName: file.name,
          fileSize: file.size,
          base64,
        })
      } else if (mode === 'url') {
        saveResponse(simulationId, step, { mode: 'url', url: url.trim(), rationale })
      }

      if (step < totalSteps) {
        router.push(`/simulate/${simulationId}/prompt/${step + 1}`)
      } else {
        setDone(true)
      }
    } catch {
      setError(
        'Could not save your response. If you uploaded a large file, try a typed response instead.'
      )
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-brand-success/30 bg-brand-success/5 px-8 py-10 text-center space-y-3">
        <div className="text-4xl text-brand-success">✓</div>
        <h2 className="text-xl font-bold text-text-primary">All responses saved</h2>
        <p className="text-sm text-text-muted max-w-sm mx-auto">
          Your responses have been stored. Evaluation and results will be available once that part
          of the platform is complete.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Prompt question */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-text-primary">{prompt.title}</h2>
        <p className="text-base text-text-primary leading-relaxed">{prompt.body}</p>
      </div>

      {/* Mode toggle */}
      {availableModes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availableModes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError('')
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-brand-primary text-white'
                  : 'border border-border bg-surface-card text-text-muted hover:text-text-primary'
              }`}
            >
              {m === 'typed' ? 'Type response' : m === 'file' ? 'Upload file' : 'Share a link'}
            </button>
          ))}
        </div>
      )}

      {/* Typed input */}
      {mode === 'typed' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="typed-response">Your response</Label>
            <WordCountHint
              count={typedWordCount}
              min={50}
              guidance={`${prompt.wordMin}–${prompt.wordMax} words recommended`}
            />
          </div>
          <Textarea
            id="typed-response"
            value={typedContent}
            onChange={(e) => setTypedContent(e.target.value)}
            placeholder="Write your response here…"
            className="min-h-[240px] resize-y"
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* File upload input */}
      {mode === 'file' && (
        <div className="space-y-2">
          <Label>Upload your document</Label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-brand-primary/50"
          >
            {file ? (
              <div className="space-y-1">
                <p className="font-medium text-text-primary">{file.name}</p>
                <p className="text-sm text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  className="mt-1 text-xs text-brand-danger hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-1 text-text-muted">
                <p className="text-sm">Click to upload a PDF or Word document</p>
                <p className="text-xs">PDF or .docx · Max 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 10 * 1024 * 1024) {
                setError('File exceeds the 10 MB limit. Please upload a smaller file.')
                return
              }
              setError('')
              setFile(f)
            }}
          />
        </div>
      )}

      {/* URL + rationale input */}
      {mode === 'url' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="url-input">Document or page URL</Label>
            <Input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rationale">
                Rationale{' '}
                <span className="font-normal text-text-muted">(required)</span>
              </Label>
              <WordCountHint count={rationaleWordCount} min={50} guidance="min 50 words" />
            </div>
            <Textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain your strategy and reasoning…"
              className="min-h-[180px] resize-y"
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-brand-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          className="bg-brand-accent hover:bg-brand-accent/90 px-8 font-semibold text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : step < totalSteps ? 'Next →' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}

function WordCountHint({
  count,
  min,
  guidance,
}: {
  count: number
  min: number
  guidance: string
}) {
  return (
    <span className={`text-xs ${count >= min ? 'text-brand-success' : 'text-text-muted'}`}>
      {count} {count === 1 ? 'word' : 'words'} · {guidance}
    </span>
  )
}

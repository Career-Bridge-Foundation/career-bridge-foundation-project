'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button } from '@/components/ui'
import { Save, ChevronDown, ChevronRight, RotateCcw, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Rubric {
  id: string
  version: number
  system_prompt: string
  model: string
  max_score: number
  is_active: boolean
}

interface RubricTabProps {
  slug: string
}

const AVAILABLE_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]

export function RubricTab({ slug }: RubricTabProps) {
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [maxScore, setMaxScore] = useState(100)
  const [isDirty, setIsDirty] = useState(false)

  const activeRubric = rubrics.find((r) => r.is_active)
  const historicRubrics = rubrics.filter((r) => !r.is_active)

  const fetchRubrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/simulations/${slug}/rubric`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const list: Rubric[] = json.rubrics ?? []
      setRubrics(list)
      const active = list.find((r) => r.is_active)
      if (active) {
        setSystemPrompt(active.system_prompt)
        setModel(active.model)
        setMaxScore(active.max_score)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rubric')
    } finally {
      setLoading(false)
      setIsDirty(false)
    }
  }, [slug])

  useEffect(() => {
    fetchRubrics()
  }, [fetchRubrics])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/simulations/${slug}/rubric`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt, model, max_score: maxScore }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      await fetchRubrics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric')
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreVersion = (rubric: Rubric) => {
    setSystemPrompt(rubric.system_prompt)
    setModel(rubric.model)
    setMaxScore(rubric.max_score)
    setIsDirty(true)
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-8">
        <Card>
          <div className="p-6 text-slate-500 text-sm">Loading rubric...</div>
        </Card>
      </div>
    )
  }

  console.log("system prompt: ", systemPrompt)

  return (
    <div className="max-w-6xl mx-auto px-8 space-y-6">
      {/* Status + save bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {activeRubric
            ? `Active: v${activeRubric.version} · ${activeRubric.model} · max ${activeRubric.max_score}`
            : 'No rubric configured — save to create v1'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRubrics}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
            title="Reload from database"
          >
            <RefreshCw size={14} />
          </button>
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            variant="primary"
            size="sm"
            leftIcon={<Save size={14} />}
          >
            {saving ? 'Saving...' : activeRubric ? `Save as v${activeRubric.version + 1}` : 'Save as v1'}
          </Button>
        </div>
      </div>

      {/* Error — always visible inside the flow, not above the fold */}
      {error && (
        <Card className="border-red-200">
          <div className="p-4 flex items-start gap-3">
            <span className="text-red-500 text-xs font-semibold mt-0.5">Error</span>
            <p className="text-sm text-red-600 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs">
              dismiss
            </button>
          </div>
        </Card>
      )}

      {/* System Prompt */}
      <Card>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">System Prompt</h3>
            <span className="text-xs text-slate-500/60">{systemPrompt.length} characters</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => { setSystemPrompt(e.target.value); setIsDirty(true) }}
            placeholder={systemPrompt}
            className="w-full h-96 bg-gray-200 border border-border rounded-lg px-4 py-3 text-slate-700 placeholder:text-slate-700/30 resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono text-sm leading-relaxed"
          />
        </div>
      </Card>

      {/* Model & Max Score */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Evaluation Settings</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500/70 block">Model</label>
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setIsDirty(true) }}
                className="w-full bg-gray-200 border border-border rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500/70 block">Max Score</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={maxScore}
                onChange={(e) => { setMaxScore(parseInt(e.target.value) || 1); setIsDirty(true) }}
                className="w-full bg-gray-200 border border-border rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Version History */}
      {historicRubrics.length > 0 && (
        <Card>
          <div className="p-6 space-y-4">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              {showHistory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Version History
              <span className="text-xs font-normal text-slate-400">({historicRubrics.length} older)</span>
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 overflow-hidden"
                >
                  {historicRubrics.map((rubric) => (
                    <div
                      key={rubric.id}
                      className="flex items-start justify-between gap-4 p-4 bg-gray-100 rounded-lg border border-border/50"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-600">v{rubric.version}</span>
                          <span className="text-xs text-slate-400">{rubric.model}</span>
                          <span className="text-xs text-slate-400">· max {rubric.max_score}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {/* {rubric.system_prompt.slice(0, 140)}{rubric.system_prompt.length > 140 ? '…' : ''} */
                            rubric.system_prompt
                          }
                          
                        </p>
                      </div>
                      <Button
                        onClick={() => handleRestoreVersion(rubric)}
                        variant="secondary"
                        size="sm"
                        leftIcon={<RotateCcw size={12} />}
                      >
                        Restore
                      </Button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      )}
    </div>
  )
}

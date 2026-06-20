'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button } from '@/components/ui'
import { Save, ChevronDown, ChevronRight, RotateCcw, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Criterion {
  name: string
  description: string
  max_points: number
}

interface VerdictBands {
  Distinction: number
  Merit: number
  Pass: number
}

interface Rubric {
  id: string
  version: number
  system_prompt: string
  model: string
  max_score: number
  is_active: boolean
  criteria: Criterion[] | null
  verdict_bands: VerdictBands | null
  output_instructions: string | null
}

interface RubricTabProps {
  slug: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]

const VERDICT_BAND_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Distinction: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Merit:       { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Pass:        { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Fail:        { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}

const defaultCriterion = (): Criterion => ({ name: '', description: '', max_points: 10 })
const defaultVerdictBands: VerdictBands = { Distinction: 85, Merit: 70, Pass: 50 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCriteria(raw: unknown): Criterion[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (c): c is Criterion =>
      c && typeof c === 'object' &&
      typeof (c as Criterion).name === 'string' &&
      typeof (c as Criterion).max_points === 'number'
  ).map(c => ({ name: c.name, description: c.description ?? '', max_points: c.max_points }))
}

function parseVerdictBands(raw: unknown): VerdictBands {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultVerdictBands
  const vb = raw as Record<string, unknown>
  return {
    Distinction: typeof vb.Distinction === 'number' ? vb.Distinction : defaultVerdictBands.Distinction,
    Merit:       typeof vb.Merit === 'number'       ? vb.Merit       : defaultVerdictBands.Merit,
    Pass:        typeof vb.Pass === 'number'        ? vb.Pass        : defaultVerdictBands.Pass,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RubricTab({ slug }: RubricTabProps) {
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [outputInstructions, setOutputInstructions] = useState('')
  const [criteria, setCriteria] = useState<Criterion[]>([defaultCriterion()])
  const [verdictBands, setVerdictBands] = useState<VerdictBands>(defaultVerdictBands)

  const activeRubric = rubrics.find(r => r.is_active)
  const historicRubrics = rubrics.filter(r => !r.is_active)
  const pointTotal = criteria.reduce((sum, c) => sum + (c.max_points || 0), 0)

  // ── Load ────────────────────────────────────────────────────────────────────
  const fetchRubrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/simulations/${slug}/rubric`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const list: Rubric[] = json.rubrics ?? []
      setRubrics(list)
      const active = list.find(r => r.is_active)
      if (active) {
        setSystemPrompt(active.system_prompt ?? '')
        setModel(active.model ?? 'claude-sonnet-4-6')
        setOutputInstructions(active.output_instructions ?? '')
        const parsed = parseCriteria(active.criteria)
        setCriteria(parsed.length > 0 ? parsed : [defaultCriterion()])
        setVerdictBands(parseVerdictBands(active.verdict_bands))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rubric')
    } finally {
      setLoading(false)
      setIsDirty(false)
    }
  }, [slug])

  useEffect(() => { fetchRubrics() }, [fetchRubrics])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/simulations/${slug}/rubric`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          model,
          criteria,
          verdict_bands: verdictBands,
          output_instructions: outputInstructions || null,
          max_score: pointTotal,
        }),
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

  // ── Criteria helpers ────────────────────────────────────────────────────────
  function updateCriterion(index: number, field: keyof Criterion, value: string | number) {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
    setIsDirty(true)
  }

  function addCriterion() {
    setCriteria(prev => [...prev, defaultCriterion()])
    setIsDirty(true)
  }

  function removeCriterion(index: number) {
    setCriteria(prev => prev.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  function updateVerdictBand(band: keyof VerdictBands, value: number) {
    setVerdictBands(prev => ({ ...prev, [band]: value }))
    setIsDirty(true)
  }

  // ── Restore from history ────────────────────────────────────────────────────
  function handleRestoreVersion(rubric: Rubric) {
    setSystemPrompt(rubric.system_prompt ?? '')
    setModel(rubric.model ?? 'claude-sonnet-4-6')
    setOutputInstructions(rubric.output_instructions ?? '')
    const parsed = parseCriteria(rubric.criteria)
    setCriteria(parsed.length > 0 ? parsed : [defaultCriterion()])
    setVerdictBands(parseVerdictBands(rubric.verdict_bands))
    setIsDirty(true)
  }

  // ── Verdict band validation state ───────────────────────────────────────────
  const bandsValid =
    verdictBands.Distinction > verdictBands.Merit &&
    verdictBands.Merit > verdictBands.Pass &&
    verdictBands.Pass >= 0 &&
    verdictBands.Distinction <= 100

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-8">
        <Card><div className="p-6 text-slate-500 text-sm">Loading rubric…</div></Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 space-y-6">

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {activeRubric
            ? `Active: v${activeRubric.version} · ${activeRubric.model} · ${activeRubric.max_score} pts`
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
            disabled={saving || !isDirty || !bandsValid}
            variant="primary"
            size="sm"
            leftIcon={<Save size={14} />}
          >
            {saving ? 'Saving…' : activeRubric ? `Save as v${activeRubric.version + 1}` : 'Save as v1'}
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
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

      {/* ── System Prompt ── */}
      <Card>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">System Prompt</h3>
            <span className="text-xs text-slate-400">{systemPrompt.length} chars</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={e => { setSystemPrompt(e.target.value); setIsDirty(true) }}
            placeholder="Write the AI evaluator system prompt here…"
            className="w-full h-64 bg-gray-100 border border-slate-200 rounded-lg px-4 py-3 text-slate-700 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-teal/30 font-mono text-sm leading-relaxed"
          />
        </div>
      </Card>

      {/* ── Criteria ── */}
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Criteria</h3>
              <p className="text-xs text-slate-400 mt-0.5">Define what the AI evaluates and how many points each criterion is worth</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(0,51,89,0.06)', color: '#003359' }}>
                Total: {pointTotal} pts
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {criteria.map((criterion, index) => (
              <div
                key={index}
                className="grid gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50"
                style={{ gridTemplateColumns: '1fr 2fr 80px 32px' }}
              >
                <input
                  type="text"
                  value={criterion.name}
                  onChange={e => updateCriterion(index, 'name', e.target.value)}
                  placeholder="Criterion name"
                  className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <input
                  type="text"
                  value={criterion.description}
                  onChange={e => updateCriterion(index, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={criterion.max_points}
                    onChange={e => updateCriterion(index, 'max_points', parseInt(e.target.value) || 1)}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-700 text-center focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <span className="text-xs text-slate-400 shrink-0">pts</span>
                </div>
                <button
                  onClick={() => removeCriterion(index)}
                  disabled={criteria.length === 1}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addCriterion}
            className="flex items-center gap-2 text-xs font-medium text-teal hover:text-teal/80 transition-colors"
          >
            <Plus size={13} /> Add criterion
          </button>

          {/* Point total bar */}
          {criteria.length > 1 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                {criteria.map((c, i) => {
                  const pct = pointTotal > 0 ? Math.round((c.max_points / pointTotal) * 100) : 0
                  const hue = (i * 47) % 360
                  return (
                    <div
                      key={i}
                      style={{ width: `${pct}%`, backgroundColor: `hsl(${hue},55%,60%)` }}
                      title={`${c.name || `Criterion ${i + 1}`}: ${c.max_points} pts`}
                    />
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {criteria.map((c, i) => {
                  const pct = pointTotal > 0 ? Math.round((c.max_points / pointTotal) * 100) : 0
                  const hue = (i * 47) % 360
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${hue},55%,60%)` }} />
                      {c.name || `Criterion ${i + 1}`}
                      <span className="text-slate-400">{c.max_points} pts ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Verdict Bands ── */}
      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Verdict Bands</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Minimum score percentage for each band. Anything below Pass is a Fail.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {(['Distinction', 'Merit', 'Pass'] as const).map(band => {
              const style = VERDICT_BAND_COLORS[band]
              return (
                <div
                  key={band}
                  className="rounded-lg p-3 space-y-2 border"
                  style={{ backgroundColor: style.bg, borderColor: style.border }}
                >
                  <div className="text-xs font-semibold" style={{ color: style.color }}>{band}</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={verdictBands[band]}
                      onChange={e => updateVerdictBand(band, parseInt(e.target.value) || 0)}
                      className="w-full bg-white border rounded-md px-2 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-teal/30"
                      style={{ borderColor: style.border, color: style.color }}
                    />
                    <span className="text-xs shrink-0" style={{ color: style.color }}>%</span>
                  </div>
                </div>
              )
            })}
            <div
              className="rounded-lg p-3 space-y-2 border"
              style={{
                backgroundColor: VERDICT_BAND_COLORS.Fail.bg,
                borderColor: VERDICT_BAND_COLORS.Fail.border
              }}
            >
              <div className="text-xs font-semibold" style={{ color: VERDICT_BAND_COLORS.Fail.color }}>Fail</div>
              <div className="flex items-center gap-1">
                <div
                  className="w-full rounded-md px-2 py-1 text-sm text-center font-semibold border"
                  style={{
                    backgroundColor: VERDICT_BAND_COLORS.Fail.bg,
                    borderColor: VERDICT_BAND_COLORS.Fail.border,
                    color: VERDICT_BAND_COLORS.Fail.color,
                  }}
                >
                  &lt; {verdictBands.Pass}%
                </div>
              </div>
            </div>
          </div>

          {!bandsValid && (
            <p className="text-xs text-red-600">
              Thresholds must satisfy: Distinction &gt; Merit &gt; Pass ≥ 0, all ≤ 100
            </p>
          )}

          {/* Visual band bar */}
          {bandsValid && (
            <div>
              <div className="flex h-3 rounded-full overflow-hidden">
                {[
                  { label: 'Distinction', min: verdictBands.Distinction, max: 100, ...VERDICT_BAND_COLORS.Distinction },
                  { label: 'Merit',       min: verdictBands.Merit,       max: verdictBands.Distinction, ...VERDICT_BAND_COLORS.Merit },
                  { label: 'Pass',        min: verdictBands.Pass,        max: verdictBands.Merit, ...VERDICT_BAND_COLORS.Pass },
                  { label: 'Fail',        min: 0,                        max: verdictBands.Pass, ...VERDICT_BAND_COLORS.Fail },
                ].map(b => (
                  <div
                    key={b.label}
                    style={{ width: `${b.max - b.min}%`, backgroundColor: b.color, opacity: 0.7 }}
                    title={`${b.label}: ${b.min}–${b.max}%`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Evaluation Settings ── */}
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Evaluation Settings</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">Model</label>
              <select
                value={model}
                onChange={e => { setModel(e.target.value); setIsDirty(true) }}
                className="w-full bg-gray-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal/30 text-sm"
              >
                {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 block">Max Score (auto)</label>
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-500 text-sm">
                {pointTotal} pts (sum of criteria)
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 block">
              Output Instructions <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={outputInstructions}
              onChange={e => { setOutputInstructions(e.target.value); setIsDirty(true) }}
              placeholder="Any specific instructions for how the AI should format or structure its evaluation output…"
              rows={3}
              className="w-full bg-gray-100 border border-slate-200 rounded-lg px-4 py-3 text-slate-700 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-teal/30 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* ── Version History ── */}
      {historicRubrics.length > 0 && (
        <Card>
          <div className="p-6 space-y-4">
            <button
              onClick={() => setShowHistory(v => !v)}
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
                  {historicRubrics.map(rubric => {
                    const cCount = Array.isArray(rubric.criteria) ? rubric.criteria.length : 0
                    return (
                      <div
                        key={rubric.id}
                        className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-600">v{rubric.version}</span>
                            <span className="text-xs text-slate-400">{rubric.model}</span>
                            <span className="text-xs text-slate-400">· {rubric.max_score} pts</span>
                            {cCount > 0 && (
                              <span className="text-xs text-slate-400">· {cCount} criteria</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate">
                            {rubric.system_prompt?.slice(0, 120)}{(rubric.system_prompt?.length ?? 0) > 120 ? '…' : ''}
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
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      )}
    </div>
  )
}

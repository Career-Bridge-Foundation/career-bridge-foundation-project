'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useReducedMotion } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  FileText,
  Copy,
  Trash2,
  Download,
  Upload,
  AlertCircle,
  ChevronDown,
  X,
} from 'lucide-react'
import {
  Button,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  AlertDialog,
  Dialog,
  EmptyState,
  Skeleton,
  DropdownMenu,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { SimulationImportSchema } from '@/lib/schemas/simulation'

// ── CSV parsing helpers ───────────────────────────────────────────────────────
function parseCsvText(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2 }
      else if (ch === '"') { inQuotes = false; i++ }
      else { field += ch; i++ }
    } else {
      if (ch === '"') { inQuotes = true; i++ }
      else if (ch === ',') { fields.push(field); field = ''; i++ }
      else if (ch === '\n') { fields.push(field); rows.push(fields); fields = []; field = ''; i++ }
      else if (ch === '\r') { i++ }
      else { field += ch; i++ }
    }
  }
  fields.push(field)
  if (fields.some(f => f !== '')) rows.push(fields)
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim())
  return rows.slice(1).map(rowFields => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = rowFields[idx] ?? '' })
    return obj
  })
}

function csvRowsToSimulations(rows: Record<string, string>[]) {
  return rows.map(row => {
    let timeRemaining: number[] = []
    let prompts: unknown[] = []
    try { if (row.time_remaining) timeRemaining = JSON.parse(row.time_remaining) } catch { /* ignore */ }
    try { if (row.prompts) prompts = JSON.parse(row.prompts) } catch { /* ignore */ }
    return {
      id: row.id?.trim() || crypto.randomUUID(),
      slug: row.slug?.trim() ?? '',
      title: row.title?.trim() ?? '',
      company: row.company?.trim() ?? '',
      industry: row.industry?.trim() ?? '',
      type: row.type?.trim() || undefined,
      difficulty: row.difficulty?.trim() ?? '',
      time: row.time?.trim() ?? '',
      description: row.description?.trim() || undefined,
      display_order: row.display_order ? parseInt(row.display_order, 10) : undefined,
      discipline: row.discipline?.trim() || undefined,
      video_url: row.video_url?.trim() || undefined,
      status: (row.status?.trim() as SimStatus) || 'draft',
      sim_role: row.sim_role?.trim() || null,
      brief_short: row.brief_short?.trim() || null,
      brief_full: row.brief_full?.trim() || null,
      video_transcript: row.video_transcript?.trim() || null,
      time_remaining: timeRemaining,
      prompts,
    }
  })
}

function fileToImportBody(file: File, text: string): { raw: unknown; error?: string } {
  if (file.name.endsWith('.csv')) {
    const rows = parseCsvText(text)
    if (rows.length === 0) return { raw: null, error: 'CSV file is empty or has no data rows' }
    return { raw: { simulations: csvRowsToSimulations(rows) } }
  }
  try {
    return { raw: JSON.parse(text) }
  } catch {
    return { raw: null, error: 'Could not read file — ensure it is valid JSON' }
  }
}

// ── Import dialog ─────────────────────────────────────────────────────────────
type ImportDiff = { created: number; updated: number; unchanged: number; total: number }

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function reset() { setFile(null); setDiff(null); setParseError(null); setImporting(false); setDragging(false) }
  function handleClose() { reset(); onClose() }

  async function processFile(f: File) {
    setFile(f); setDiff(null); setParseError(null)
    try {
      const text = await f.text()
      const { raw, error } = fileToImportBody(f, text)
      if (error) { setParseError(error); return }
      const result = SimulationImportSchema.safeParse(raw)
      if (!result.success) { setParseError(result.error.issues[0]?.message ?? 'Invalid format'); return }
      const res = await fetch('/api/admin/simulations/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
      })
      const data = await res.json()
      if (!res.ok) setParseError(data.formErrors?.[0] ?? data.error ?? 'Validation failed')
      else setDiff(data as ImportDiff)
    } catch { setParseError('Could not read file') }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) processFile(f) }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.json') && !f.name.endsWith('.csv')) { setParseError('Only .json and .csv files are supported'); return }
    processFile(f)
  }

  async function handleImport() {
    if (!file || !diff) return
    setImporting(true)
    try {
      const text = await file.text()
      const { raw, error } = fileToImportBody(file, text)
      if (error) { toast.error(error); setImporting(false); return }
      const res = await fetch('/api/admin/simulations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
      })
      if (res.ok) { toast.success(`Import complete — ${diff.created} created, ${diff.updated} updated`); handleClose(); onDone() }
      else { const json = await res.json(); toast.error(json.error ?? 'Import failed') }
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Import simulations</h2>
          <p className="text-sm text-slate-500 mt-1">Upload a JSON or CSV file. Existing slugs will be updated.</p>
        </div>
        <div
          role="button" tabIndex={0} aria-label="Upload file"
          className={cn(
            'rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer select-none',
            parseError ? 'border-destructive bg-destructive/5'
              : dragging ? 'border-[#4DC5D2] bg-[#4DC5D2]/5'
              : 'border-[#e4eaf3] hover:border-[#4DC5D2]/40 bg-[#f8fafd]'
          )}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Upload size={20} className={cn('mx-auto mb-3', dragging ? 'text-[#4DC5D2]' : 'text-slate-300')} />
          {file ? (
            <p className="text-sm font-semibold text-[#003359]">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-[rgba(0,51,89,0.65)]">
                {dragging ? 'Drop to upload' : 'Click or drag a file here'}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-[#eef2f7] text-[rgba(0,51,89,0.55)]">JSON</span>
                <span className="text-[rgba(0,51,89,0.25)] text-xs">·</span>
                <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-[#eef2f7] text-[rgba(0,51,89,0.55)]">CSV</span>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFile} />
        </div>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-3 py-2.5 border border-destructive/20">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {diff && (
          <div className="rounded-xl border border-[#e4eaf3] bg-[#f8fafd] p-4 space-y-2">
            <p className="text-[10px] text-[rgba(0,51,89,0.45)] uppercase tracking-widest font-bold mb-3">Preview</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 py-3">
                <p className="text-2xl font-bold text-emerald-700">{diff.created}</p>
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">New</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 py-3">
                <p className="text-2xl font-bold text-blue-700">{diff.updated}</p>
                <p className="text-xs text-blue-600 mt-0.5 font-medium">Updated</p>
              </div>
              <div className="rounded-xl bg-[#f0f4f8] border border-[#e4eaf3] py-3">
                <p className="text-2xl font-bold text-[#003359]">{diff.total}</p>
                <p className="text-xs text-[rgba(0,51,89,0.5)] mt-0.5 font-medium">Total</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!diff || !!parseError || importing} onClick={handleImport}>
            {importing ? 'Importing…' : `Import ${diff ? diff.total : ''} simulations`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SimStatus = 'draft' | 'pending_review' | 'published' | 'archived'

type SimListItem = {
  slug: string
  title: string
  company: string
  industry: string
  discipline?: string | null
  difficulty: 'Foundation' | 'Practitioner' | 'Advanced'
  time: string
  status: SimStatus
  published_at: string | null
  display_order: number
  updated_at: string
}

// ── Style constants ───────────────────────────────────────────────────────────
const DIFF_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  Foundation:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Practitioner: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Advanced:     { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
}

const STATUS_DOT: Record<string, string> = {
  draft:          '#94a3b8',
  pending_review: '#3b82f6',
  published:      '#16a34a',
  archived:       '#f59e0b',
}

const STATUS_TEXT: Record<string, string> = {
  draft:          '#64748b',
  pending_review: '#1d4ed8',
  published:      '#16a34a',
  archived:       '#d97706',
}

const STATUS_LABEL: Record<SimStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  published:      'Published',
  archived:       'Archived',
}

// ── Status tab (primary filter) ───────────────────────────────────────────────
function StatusTab({
  label,
  count,
  active,
  dotColor,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  dotColor?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap shrink-0',
        active
          ? 'text-[#003359] border-b-[#003359]'
          : 'text-[rgba(0,51,89,0.42)] border-b-transparent hover:text-[#003359] hover:border-b-[rgba(0,51,89,0.15)]'
      )}
    >
      {dotColor && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: active ? dotColor : 'rgba(0,51,89,0.2)' }}
        />
      )}
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-center leading-none pt-[3px] pb-[3px]',
            active
              ? 'bg-[#003359] text-white'
              : 'bg-[#eef2f7] text-[rgba(0,51,89,0.45)]'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ── Filter pill (secondary filters) ──────────────────────────────────────────
function FilterPill({
  label,
  count,
  active,
  bg,
  color,
  border,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  bg?: string
  color?: string
  border?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
      style={
        active
          ? { backgroundColor: bg ?? '#eef2f7', color: color ?? '#003359', borderColor: border ?? '#e4eaf3' }
          : { backgroundColor: '#ffffff', color: 'rgba(0,51,89,0.55)', borderColor: '#e4eaf3' }
      }
    >
      {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color ?? '#003359' }} />}
      {label}
      {count !== undefined && (
        <span style={{ color: active ? color ?? '#003359' : 'rgba(0,51,89,0.35)', opacity: 0.8 }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TR key={i} className="h-[60px]">
          <TD className="w-10 pl-4"><Skeleton className="h-4 w-4 rounded" /></TD>
          <TD className="py-4">
            <Skeleton className="h-4 w-48 rounded mb-2" />
            <Skeleton className="h-3 w-28 rounded" />
          </TD>
          <TD><Skeleton className="h-5 w-24 rounded-full" /></TD>
          <TD><Skeleton className="h-5 w-20 rounded-lg" /></TD>
          <TD><Skeleton className="h-5 w-24 rounded-lg" /></TD>
          <TD><Skeleton className="h-4 w-20 rounded" /></TD>
          <TD className="w-12"><Skeleton className="h-7 w-7 rounded-lg" /></TD>
        </TR>
      ))}
    </>
  )
}

// ── Sortable row ──────────────────────────────────────────────────────────────
function SortableRow({
  sim,
  onDelete,
  onDuplicate,
  highlightedSlug,
}: {
  sim: SimListItem
  onDelete: (sim: SimListItem) => void
  onDuplicate: (sim: SimListItem) => void
  highlightedSlug: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sim.slug })

  const diff = DIFF_BADGE[sim.difficulty]

  return (
    <TR
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group h-[60px] transition-colors',
        isDragging && 'opacity-40 bg-[#f8fafd]',
        highlightedSlug === sim.slug ? 'bg-[#4DC5D2]/8' : 'hover:bg-[#f5f8fd]'
      )}
    >
      {/* Drag handle — hidden until row hover */}
      <TD className="w-10 pl-4 pr-0">
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-[#003359] cursor-grab active:cursor-grabbing focus-visible:outline-none transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical size={15} />
        </button>
      </TD>

      {/* Simulation: title + company + discipline */}
      <TD className="py-4 max-w-xs">
        <Link href={`/admin/simulations/${sim.slug}`} className="group/link block">
          <span className="font-semibold text-sm text-[#003359] group-hover/link:text-[#006FAD] transition-colors line-clamp-1">
            {sim.title}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[rgba(0,51,89,0.42)]">{sim.company}</span>
            {sim.discipline && (
              <>
                <span className="text-[rgba(0,51,89,0.2)] text-xs">·</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold leading-none"
                  style={{ backgroundColor: '#f3f0ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                >
                  {sim.discipline}
                </span>
              </>
            )}
          </div>
        </Link>
      </TD>

      {/* Status — dot + label */}
      <TD>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: STATUS_DOT[sim.status] ?? '#94a3b8' }}
          />
          <span className="text-sm font-medium" style={{ color: STATUS_TEXT[sim.status] ?? '#64748b' }}>
            {STATUS_LABEL[sim.status] ?? sim.status}
          </span>
        </div>
      </TD>

      {/* Difficulty */}
      <TD>
        {diff ? (
          <span
            className="text-xs px-2.5 py-1 rounded-lg font-semibold border"
            style={{ backgroundColor: diff.bg, color: diff.color, borderColor: diff.border }}
          >
            {sim.difficulty}
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold border bg-[#f0f4f8] text-[rgba(0,51,89,0.5)] border-[#e4eaf3]">
            {sim.difficulty}
          </span>
        )}
      </TD>

      {/* Industry */}
      <TD>
        <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-[#f0f4f8] text-[rgba(0,51,89,0.6)]">
          {sim.industry}
        </span>
      </TD>

      {/* Updated */}
      <TD className="text-xs text-[rgba(0,51,89,0.42)] whitespace-nowrap">
        {formatDistanceToNow(new Date(sim.updated_at), { addSuffix: true })}
      </TD>

      {/* Actions — hidden until row hover */}
      <TD className="w-12 pr-3">
        <DropdownMenu
          align="end"
          trigger={
            <button
              className="p-1.5 rounded-lg text-[rgba(0,51,89,0.35)] opacity-0 group-hover:opacity-100 hover:text-[#003359] hover:bg-[#eef2f7] transition-all focus-visible:outline-none focus-visible:opacity-100"
              aria-label="Row actions"
            >
              <MoreHorizontal size={15} />
            </button>
          }
        >
          <Link
            href={`/admin/simulations/${sim.slug}`}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#003359] hover:bg-[#f5f8fd] rounded-md transition-colors"
          >
            <Pencil size={13} className="text-[rgba(0,51,89,0.4)]" /> Edit metadata
          </Link>
          <Link
            href={`/admin/simulations/${sim.slug}/content`}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#003359] hover:bg-[#f5f8fd] rounded-md transition-colors"
          >
            <FileText size={13} className="text-[rgba(0,51,89,0.4)]" /> Edit content
          </Link>
          <button
            onClick={() => onDuplicate(sim)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#003359] hover:bg-[#f5f8fd] rounded-md transition-colors"
          >
            <Copy size={13} className="text-[rgba(0,51,89,0.4)]" /> Duplicate
          </button>
          <div className="my-1 border-t border-[#eef2f7]" />
          <button
            onClick={() => onDelete(sim)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/8 rounded-md transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </DropdownMenu>
      </TD>
    </TR>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
function SimulationsListPageInner() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<SimListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '')
  const [diffFilter, setDiffFilter] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SimListItem | null>(null)
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [canExport, setCanExport] = useState(false)

  const loadSims = useCallback(async () => {
    const res = await fetch('/api/admin/simulations')
    if (res.ok) setItems(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { loadSims() }, [loadSims])

  useEffect(() => {
    fetch('/api/admin/me')
      .then(r => r.json())
      .then(d => setCanExport(d.permissions?.canExportData === true))
      .catch(() => {})
  }, [])

  async function handleExport(format: 'json' | 'csv' | 'csv-meta' | 'tsv') {
    setIsExporting(true)
    const ext = format === 'json' ? 'json' : format === 'tsv' ? 'tsv' : 'csv'
    const label = format === 'csv-meta' ? 'simulations-meta' : 'simulations'
    try {
      const res = await fetch(`/api/admin/simulations/export?format=${format}`)
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label}-${new Date().toISOString().slice(0, 10)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed') }
    finally { setIsExporting(false) }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.slug === active.id)
    const newIndex = items.findIndex(i => i.slug === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, display_order: idx + 1 }))
    const snapshot = items
    setItems(reordered)
    if (!reduced) { setHighlightedSlug(active.id as string); setTimeout(() => setHighlightedSlug(null), 600) }
    fetch('/api/admin/simulations/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered.map(i => ({ slug: i.slug, display_order: i.display_order }))),
    }).then(r => { if (!r.ok) { toast.error('Failed to save order'); setItems(snapshot) } })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const slug = deleteTarget.slug; const title = deleteTarget.title
    setDeleteTarget(null)
    const snapshot = items
    setItems(prev => prev.filter(s => s.slug !== slug))
    const res = await fetch(`/api/admin/simulations/${slug}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Delete failed'); setItems(snapshot) }
    else toast.success(`"${title}" deleted`)
  }

  async function handleDuplicate(sim: SimListItem) {
    const fullRes = await fetch(`/api/admin/simulations/${sim.slug}`)
    if (!fullRes.ok) { toast.error('Could not load simulation'); return }
    const full = await fullRes.json()
    const baseSlug = `${sim.slug}-copy`.slice(0, 57)
    const res = await fetch('/api/admin/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${sim.title} (Copy)`, company: full.company ?? '', industry: full.industry ?? '', type: full.type ?? '', difficulty: full.difficulty ?? 'Foundation', time: full.time ?? '', description: full.description ?? '', slug: baseSlug }),
    })
    if (res.ok) { toast.success('Duplicated'); loadSims() }
    else { const json = await res.json(); toast.error(json.fieldErrors?.slug?.[0] ?? 'Duplicate failed') }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const disciplineOptions = Array.from(new Set(items.map(s => s.discipline).filter(Boolean) as string[])).sort()

  const filtered = items.filter(s => {
    const q = search.toLowerCase()
    return (
      (!q || s.title?.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q)) &&
      (!statusFilter || s.status === statusFilter) &&
      (!diffFilter || s.difficulty === diffFilter) &&
      (!disciplineFilter || s.discipline === disciplineFilter)
    )
  })

  const statusCounts = items.reduce<Record<string, number>>((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc }, {})
  const diffCounts   = items.reduce<Record<string, number>>((acc, s) => { acc[s.difficulty] = (acc[s.difficulty] ?? 0) + 1; return acc }, {})
  const disciplineCounts = items.reduce<Record<string, number>>((acc, s) => { if (s.discipline) acc[s.discipline] = (acc[s.discipline] ?? 0) + 1; return acc }, {})

  const hasSecondaryFilter = !!(diffFilter || disciplineFilter)
  const hasAnyFilter = !!(search || statusFilter || diffFilter || disciplineFilter)
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDiffFilter(''); setDisciplineFilter('') }

  const hasDiffOptions = (['Foundation', 'Practitioner', 'Advanced'] as const).some(d => diffCounts[d])
  const showSecondaryRow = hasDiffOptions || disciplineOptions.length > 0

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight" style={{ color: '#003359', letterSpacing: '-0.01em' }}>
            Simulations
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(0,51,89,0.42)' }}>
            {isLoading ? '—' : `${items.length} simulation${items.length !== 1 ? 's' : ''} in library`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canExport && (
            <DropdownMenu
              align="end"
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={13} />}
                  rightIcon={<ChevronDown size={12} />}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting…' : 'Export'}
                </Button>
              }
            >
              {(
                [
                  { format: 'json',     label: 'JSON',          hint: 're-importable backup' },
                  { format: 'csv',      label: 'CSV (full)',     hint: 'all fields' },
                  { format: 'csv-meta', label: 'CSV (metadata)', hint: 'no prompts / briefs' },
                  { format: 'tsv',      label: 'TSV',            hint: 'paste into Excel' },
                ] as const
              ).map(({ format, label, hint }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="flex items-center justify-between gap-6 w-full px-3 py-2 text-sm text-[#003359] hover:bg-[#f5f8fd] rounded-md transition-colors"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-[rgba(0,51,89,0.38)]">{hint}</span>
                </button>
              ))}
            </DropdownMenu>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Upload size={13} />}
            onClick={() => setImportOpen(true)}
          >
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => router.push('/admin/simulations/new')}
            style={{ backgroundColor: '#003359' }}
          >
            New simulation
          </Button>
        </div>
      </div>

      {/* ── Table card ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#fff', border: '1px solid #e4eaf3', boxShadow: '0 1px 8px rgba(0,51,89,0.06)' }}
      >

        {/* ── Row A: Search ──────────────────────────────────────────────── */}
        <div
          className="px-5 py-3.5 flex flex-wrap items-center gap-3"
          style={{ borderBottom: '1px solid #eef2f7' }}
        >
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'rgba(0,51,89,0.32)' }}
            />
            <input
              type="text"
              placeholder="Search by title or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm rounded-xl pl-9 pr-8 py-2.5 border transition-all focus:outline-none focus:ring-2"
              style={{
                color: '#003359',
                backgroundColor: '#f8fafd',
                borderColor: search ? '#4DC5D2' : '#e4eaf3',
                boxShadow: search ? '0 0 0 3px rgba(77,197,210,0.12)' : undefined,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'rgba(0,51,89,0.35)' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Result count + clear */}
          <div className="ml-auto flex items-center gap-3">
            {!isLoading && (
              <span className="text-xs" style={{ color: 'rgba(0,51,89,0.4)' }}>
                {hasAnyFilter ? (
                  <><strong style={{ color: '#003359' }}>{filtered.length}</strong> of {items.length}</>
                ) : (
                  <>{items.length} total</>
                )}
              </span>
            )}
            {hasAnyFilter && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold transition-colors"
                style={{ color: 'rgba(0,51,89,0.45)' }}
              >
                Clear all <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* ── Row B: Status tabs ─────────────────────────────────────────── */}
        <div
          className="flex items-center overflow-x-auto px-1"
          style={{ borderBottom: '1px solid #eef2f7' }}
        >
          <StatusTab
            label="All"
            count={items.length}
            active={!statusFilter}
            onClick={() => setStatusFilter('')}
          />
          {(['draft', 'pending_review', 'published', 'archived'] as const).map(s =>
            statusCounts[s] ? (
              <StatusTab
                key={s}
                label={STATUS_LABEL[s]}
                count={statusCounts[s]}
                active={statusFilter === s}
                dotColor={STATUS_DOT[s]}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              />
            ) : null
          )}
        </div>

        {/* ── Row C: Secondary filters (difficulty + discipline) ─────────── */}
        {showSecondaryRow && (
          <div
            className="flex items-center gap-2 px-5 py-2.5 flex-wrap"
            style={{ borderBottom: '1px solid #eef2f7', backgroundColor: '#fafbfd' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: 'rgba(0,51,89,0.35)' }}>
              Filters
            </span>

            {/* Difficulty pills */}
            {(['Foundation', 'Practitioner', 'Advanced'] as const).map(d =>
              diffCounts[d] ? (
                <FilterPill
                  key={d}
                  label={d}
                  count={diffCounts[d]}
                  active={diffFilter === d}
                  bg={DIFF_BADGE[d]?.bg}
                  color={DIFF_BADGE[d]?.color}
                  border={DIFF_BADGE[d]?.border}
                  onClick={() => setDiffFilter(diffFilter === d ? '' : d)}
                />
              ) : null
            )}

            {/* Divider if both groups exist */}
            {hasDiffOptions && disciplineOptions.length > 0 && (
              <span className="h-4 w-px bg-[#e4eaf3] shrink-0" />
            )}

            {/* Discipline pills */}
            {disciplineOptions.map(d => (
              <FilterPill
                key={d}
                label={d}
                count={disciplineCounts[d]}
                active={disciplineFilter === d}
                bg="rgba(124,58,237,0.08)"
                color="#7c3aed"
                border="rgba(124,58,237,0.2)"
                onClick={() => setDisciplineFilter(disciplineFilter === d ? '' : d)}
              />
            ))}

            {hasSecondaryFilter && (
              <button
                onClick={() => { setDiffFilter(''); setDisciplineFilter('') }}
                className="ml-auto text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{ color: 'rgba(0,51,89,0.4)' }}
              >
                Reset <X size={11} />
              </button>
            )}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(s => s.slug)} strategy={verticalListSortingStrategy}>
            <Table className="bg-white min-w-[640px]">
              <THead className="bg-[#f8fafd] border-b border-[#eef2f7]">
                <TH className="pl-4 w-10">{null}</TH>
                <TH className="text-[10px] font-bold uppercase tracking-wider py-3 text-[rgba(0,51,89,0.4)]">
                  Simulation
                </TH>
                <TH className="text-[10px] font-bold uppercase tracking-wider py-3 text-[rgba(0,51,89,0.4)]">
                  Status
                </TH>
                <TH className="text-[10px] font-bold uppercase tracking-wider py-3 text-[rgba(0,51,89,0.4)]">
                  Difficulty
                </TH>
                <TH className="text-[10px] font-bold uppercase tracking-wider py-3 text-[rgba(0,51,89,0.4)]">
                  Industry
                </TH>
                <TH className="text-[10px] font-bold uppercase tracking-wider py-3 text-[rgba(0,51,89,0.4)]">
                  Updated
                </TH>
                <TH className="w-12">{null}</TH>
              </THead>

              <TBody className="divide-y divide-[#f0f4f8]">
                {isLoading ? (
                  <SkeletonRows />
                ) : filtered.length === 0 ? (
                  <TR>
                    <TD colSpan={7} className="bg-white py-16">
                      <EmptyState
                        title={hasAnyFilter ? 'No simulations match your filters' : 'No simulations yet'}
                        description={
                          hasAnyFilter
                            ? 'Try adjusting your search or filters.'
                            : 'Create your first simulation to get started.'
                        }
                        action={
                          hasAnyFilter
                            ? { label: 'Clear filters', onClick: clearFilters }
                            : { label: 'New simulation', onClick: () => router.push('/admin/simulations/new') }
                        }
                      />
                    </TD>
                  </TR>
                ) : (
                  filtered.map(sim => (
                    <SortableRow
                      key={sim.slug}
                      sim={sim}
                      onDelete={setDeleteTarget}
                      onDuplicate={handleDuplicate}
                      highlightedSlug={highlightedSlug}
                    />
                  ))
                )}
              </TBody>
            </Table>
          </SortableContext>
        </DndContext>
        </div>

        {/* ── Footer count ──────────────────────────────────────────────── */}
        {!isLoading && filtered.length > 0 && (
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid #eef2f7', backgroundColor: '#fafbfd' }}
          >
            <span className="text-xs" style={{ color: 'rgba(0,51,89,0.4)' }}>
              {hasAnyFilter
                ? `Showing ${filtered.length} of ${items.length} simulations`
                : `${items.length} simulation${items.length !== 1 ? 's' : ''} total`}
            </span>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(0,51,89,0.28)' }}>
              Drag rows to reorder
            </span>
          </div>
        )}
      </div>

      {/* ── Delete dialog ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <h2 className="text-base font-semibold" style={{ color: '#003359' }}>Delete simulation?</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,51,89,0.6)' }}>
            This will permanently delete{' '}
            <strong style={{ color: '#003359' }}>{deleteTarget?.title}</strong>{' '}
            and all associated data. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </AlertDialog>

      {/* ── Import dialog ────────────────────────────────────────────────── */}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={loadSims} />
    </div>
  )
}

export default function SimulationsListPage() {
  return (
    <Suspense>
      <SimulationsListPageInner />
    </Suspense>
  )
}

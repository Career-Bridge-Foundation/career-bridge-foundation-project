'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  SegmentedControl,
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

  function reset() {
    setFile(null)
    setDiff(null)
    setParseError(null)
    setImporting(false)
    setDragging(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function processFile(f: File) {
    setFile(f)
    setDiff(null)
    setParseError(null)
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
    } catch {
      setParseError('Could not read file')
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.json') && !f.name.endsWith('.csv')) {
      setParseError('Only .json and .csv files are supported')
      return
    }
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
      if (res.ok) {
        toast.success(`Import complete — ${diff.created} created, ${diff.updated} updated`)
        handleClose()
        onDone()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5">
        <div>
          {/* Dialog uses card colors: bg-card / text-foreground */}
          <h2 className="text-base font-semibold text-slate-900">Import simulations</h2>
          <p className="text-sm text-slate-600 mt-1">
            Upload a JSON or CSV file. Existing slugs will be updated.
          </p>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file"
          className={cn(
            'rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer select-none',
            parseError
              ? 'border-destructive bg-destructive/5'
              : dragging
              ? 'border-teal bg-teal/5'
              : 'border-slate-300 hover:border-teal/40 bg-slate-50'
          )}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Upload size={20} className={cn('mx-auto mb-3', dragging ? 'text-teal' : 'text-slate-400')} />
          {file ? (
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-slate-700 font-medium">
                {dragging ? 'Drop to upload' : 'Click or drag a file here'}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-600 tracking-wide">JSON</span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-slate-200 text-slate-600 tracking-wide">CSV</span>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFile} />
        </div>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 rounded-lg px-3 py-2.5 border border-destructive/25">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {diff && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 space-y-2">
            <p className="text-xs text-slate-600 uppercase tracking-widest font-medium mb-3">Preview</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-emerald-50 border border-emerald-200 py-3">
                <p className="text-xl font-bold text-emerald-700">{diff.created}</p>
                <p className="text-xs text-emerald-600 mt-0.5">New</p>
              </div>
              <div className="rounded-md bg-sky-50 border border-sky-200 py-3">
                <p className="text-xl font-bold text-sky-700">{diff.updated}</p>
                <p className="text-xs text-sky-600 mt-0.5">Updated</p>
              </div>
              <div className="rounded-md bg-slate-100 border border-slate-300 py-3">
                <p className="text-xl font-bold text-slate-900">{diff.total}</p>
                <p className="text-xs text-slate-600 mt-0.5">Total</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!diff || !!parseError || importing}
            onClick={handleImport}
          >
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

// Light-theme difficulty badges aligned with config's warm palette
const DIFF_BADGE: Record<string, string> = {
  Foundation: 'bg-emerald-50  text-emerald-700  border-emerald-200',
  Practitioner: 'bg-amber-50    text-amber-700    border-amber-200',
  Advanced: 'bg-rose-50     text-rose-700     border-rose-200',
}

const STATUS_BADGE: Record<SimStatus, string> = {
  draft:          'bg-slate-100   text-slate-600   border-slate-300',
  pending_review: 'bg-blue-50     text-blue-700    border-blue-200',
  published:      'bg-emerald-50  text-emerald-700  border-emerald-200',
  archived:       'bg-amber-50    text-amber-700    border-amber-200',
}

const STATUS_LABEL: Record<SimStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  published:      'Published',
  archived:       'Archived',
}

const DIFF_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Foundation', value: 'Foundation' },
  { label: 'Practitioner', value: 'Practitioner' },
  { label: 'Advanced', value: 'Advanced' },
]

const STATUS_OPTIONS = [
  { label: 'All',            value: '' },
  { label: 'Draft',          value: 'draft' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'Published',      value: 'published' },
  { label: 'Archived',       value: 'archived' },
]

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TR key={i}>
          <TD className="w-8 pl-3 pr-1"><Skeleton className="h-4 w-4 rounded" /></TD>
          <TD>
            <Skeleton className="h-4 w-40 rounded mb-1.5" />
            <Skeleton className="h-3 w-24 rounded" />
          </TD>
          <TD><Skeleton className="h-5 w-16 rounded-full" /></TD>
          <TD><Skeleton className="h-5 w-20 rounded-full" /></TD>
          <TD><Skeleton className="h-5 w-24 rounded-full" /></TD>
          <TD><Skeleton className="h-4 w-14 rounded" /></TD>
          <TD><Skeleton className="h-4 w-20 rounded" /></TD>
          <TD className="w-10"><Skeleton className="h-6 w-6 rounded" /></TD>
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

  return (
    <TR
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'transition-colors duration-[600ms]',
        isDragging && 'opacity-40',
        // accent-teal at low opacity for the highlight flash
        highlightedSlug === sim.slug && 'bg-accent/8'
      )}
    >
      {/* Drag handle */}
      <TD className="w-8 pl-3 pr-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 rounded p-0.5 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      </TD>

      {/* Title + company + discipline */}
      <TD className="py-3.5 max-w-xs">
        <Link href={`/admin/simulations/${sim.slug}`} className="group block">
          <span className="font-medium text-[#003359] group-hover:text-teal line-clamp-1 transition-colors">
            {sim.title}
          </span>
          <span className="text-xs text-slate-600 mt-0.5 block">{sim.company}</span>
          {sim.discipline && (
            <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 font-medium leading-none">
              {sim.discipline}
            </span>
          )}
        </Link>
      </TD>

      {/* Industry */}
      <TD>
        <Badge
          variant="neutral"
          className="bg-slate-100 text-slate-900 text-xs border border-slate-200"
        >
          {sim.industry}
        </Badge>
      </TD>

      {/* Difficulty */}
      <TD>
        <Badge
          variant="neutral"
          className={cn('text-xs border', DIFF_BADGE[sim.difficulty] ?? 'bg-slate-100 text-slate-900')}
        >
          {sim.difficulty}
        </Badge>
      </TD>

      {/* Status */}
      <TD>
        <Badge
          variant="neutral"
          className={cn('text-xs border', STATUS_BADGE[sim.status] ?? STATUS_BADGE.draft)}
        >
          {STATUS_LABEL[sim.status] ?? sim.status}
        </Badge>
      </TD>

      {/* Time */}
      <TD className="text-slate-700 text-sm">{sim.time}</TD>

      {/* Updated */}
      <TD className="text-slate-600 text-sm whitespace-nowrap">
        {formatDistanceToNow(new Date(sim.updated_at), { addSuffix: true })}
      </TD>

      {/* Actions */}
      <TD className="w-10">
        <DropdownMenu
          align="end"
          trigger={
            <button
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 transition-colors"
              aria-label="Row actions"
            >
              <MoreHorizontal size={15} />
            </button>
          }
        >
          <Link
            href={`/admin/simulations/${sim.slug}`}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 rounded-sm transition-colors"
          >
            <Pencil size={13} /> Edit metadata
          </Link>
          <Link
            href={`/admin/simulations/${sim.slug}/content`}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 rounded-sm transition-colors"
          >
            <FileText size={13} /> Edit content
          </Link>
          <button
            onClick={() => onDuplicate(sim)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 rounded-sm transition-colors"
          >
            <Copy size={13} /> Duplicate
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button
            onClick={() => onDelete(sim)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/8 rounded-sm transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </DropdownMenu>
      </TD>
    </TR>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SimulationsListPage() {
  const router = useRouter()
  const reduced = useReducedMotion()

  const [items, setItems] = useState<SimListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [diffFilter, setDiffFilter] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SimListItem | null>(null)
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const loadSims = useCallback(async () => {
    const res = await fetch('/api/admin/simulations')
    if (res.ok) setItems(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { loadSims() }, [loadSims])

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
    } catch {
      toast.error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => i.slug === active.id)
    const newIndex = items.findIndex(i => i.slug === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      display_order: idx + 1,
    }))

    const snapshot = items
    setItems(reordered)

    if (!reduced) {
      setHighlightedSlug(active.id as string)
      setTimeout(() => setHighlightedSlug(null), 600)
    }

    fetch('/api/admin/simulations/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered.map(i => ({ slug: i.slug, display_order: i.display_order }))),
    }).then(r => {
      if (!r.ok) {
        toast.error('Failed to save order')
        setItems(snapshot)
      }
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const slug = deleteTarget.slug
    const title = deleteTarget.title
    setDeleteTarget(null)
    const snapshot = items
    setItems(prev => prev.filter(s => s.slug !== slug))

    const res = await fetch(`/api/admin/simulations/${slug}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Delete failed')
      setItems(snapshot)
    } else {
      toast.success(`"${title}" deleted`)
    }
  }

  async function handleDuplicate(sim: SimListItem) {
    const fullRes = await fetch(`/api/admin/simulations/${sim.slug}`)
    if (!fullRes.ok) { toast.error('Could not load simulation'); return }
    const full = await fullRes.json()

    const baseSlug = `${sim.slug}-copy`.slice(0, 57)
    const res = await fetch('/api/admin/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${sim.title} (Copy)`,
        company: full.company ?? '',
        industry: full.industry ?? '',
        type: full.type ?? '',
        difficulty: full.difficulty ?? 'Foundation',
        time: full.time ?? '',
        description: full.description ?? '',
        slug: baseSlug,
      }),
    })
    if (res.ok) {
      toast.success('Duplicated')
      loadSims()
    } else {
      const json = await res.json()
      toast.error(json.fieldErrors?.slug?.[0] ?? 'Duplicate failed')
    }
  }

  const disciplineOptions = Array.from(
    new Set(items.map(s => s.discipline).filter(Boolean) as string[])
  ).sort()

  const filtered = items.filter(s => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q || s.title?.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q)
    const matchesStatus = !statusFilter || s.status === statusFilter
    const matchesDiff = !diffFilter || s.difficulty === diffFilter
    const matchesDiscipline = !disciplineFilter || s.discipline === disciplineFilter
    return matchesSearch && matchesStatus && matchesDiff && matchesDiscipline
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Simulations</h1>
          <p className="text-sm mt-0.5 text-slate-600">
            {isLoading ? '—' : `${items.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                { format: 'json',     label: 'JSON',             hint: 're-importable backup' },
                { format: 'csv',      label: 'CSV (full)',        hint: 'all fields' },
                { format: 'csv-meta', label: 'CSV (metadata)',    hint: 'no prompts / briefs' },
                { format: 'tsv',      label: 'TSV',              hint: 'paste into Excel' },
              ] as const
            ).map(({ format, label, hint }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className="flex items-center justify-between gap-6 w-full px-3 py-2 z-[10] text-sm text-slate-900 hover:bg-slate-100 rounded-sm transition-colors"
              >
                <span>{label}</span>
                <span className="text-xs text-slate-400">{hint}</span>
              </button>
            ))}
          </DropdownMenu>
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
          >
            New simulation
          </Button>
        </div>
      </div>

      {/* Filter + table card */}
      {/* Table card */}
      <div className="rounded-xl overflow-hidden bg-white border border-slate-300 shadow-sm">

        {/* Toolbar */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by title or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full bg-white text-slate-900 text-sm',
                'rounded-md pl-8 pr-3 py-1.5',
                'placeholder:text-slate-400',
                'border border-slate-300 focus:border-teal focus:ring-2 focus:ring-teal/20 outline-none transition-all',
              )}
            />
          </div>

          {/* Status filter */}
          <SegmentedControl
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Difficulty filter */}
          <SegmentedControl
            options={DIFF_OPTIONS}
            value={diffFilter}
            onChange={setDiffFilter}
          />

          {/* Discipline filter */}
          {disciplineOptions.length > 0 && (
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
              className={cn(
                'bg-white text-slate-900 text-sm rounded-md px-3 py-1.5',
                'border border-slate-300 focus:border-teal focus:ring-2 focus:ring-teal/20 outline-none transition-all',
              )}
            >
              <option value="">All disciplines</option>
              {disciplineOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>

        {/* Table */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map(s => s.slug)}
            strategy={verticalListSortingStrategy}
          >
            <Table className="bg-white">
              <THead className="bg-slate-50 border-b border-slate-200">
                <TH className="pl-3 w-8">{null}</TH>
                <TH className="text-slate-600">Title</TH>
                <TH className="text-slate-600">Industry</TH>
                <TH className="text-slate-600">Difficulty</TH>
                <TH className="text-slate-600">Status</TH>
                <TH className="text-slate-600">Time</TH>
                <TH className="text-slate-600">Updated</TH>
                <TH className="w-10">{null}</TH>
              </THead>
              <TBody className="divide-y">
                {isLoading ? (
                  <SkeletonRows />
                ) : filtered.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="bg-white">
                      <EmptyState
                        title="No simulations match your filters"
                        description="Adjust your search or filters to find simulations."
                        action={
                          search || statusFilter || diffFilter || disciplineFilter
                            ? {
                              label: 'Clear filters',
                              onClick: () => { setSearch(''); setStatusFilter(''); setDiffFilter(''); setDisciplineFilter('') },
                            }
                            : undefined
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
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Delete simulation?</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            This will permanently delete{' '}
            <strong className="text-slate-900 font-medium">{deleteTarget?.title}</strong>{' '}
            and all associated data. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </AlertDialog>

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={loadSims}
      />
    </div>
  )
}
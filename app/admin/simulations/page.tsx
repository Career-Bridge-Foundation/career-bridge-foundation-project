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

// ── Import dialog ─────────────────────────────────────────────────────────────
type ImportDiff = { created: number; updated: number; unchanged: number; total: number }

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setDiff(null)
    setParseError(null)
    setImporting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setDiff(null)
    setParseError(null)

    try {
      const text = await f.text()
      const raw = JSON.parse(text)
      const result = SimulationImportSchema.safeParse(raw)
      if (!result.success) {
        setParseError(result.error.issues[0]?.message ?? 'Invalid format')
        return
      }

      const res = await fetch('/api/admin/simulations/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
      })
      const data = await res.json()
      if (!res.ok) {
        setParseError(data.formErrors?.[0] ?? data.error ?? 'Validation failed')
      } else {
        setDiff(data as ImportDiff)
      }
    } catch {
      setParseError('Could not read file — ensure it is valid JSON')
    }
  }

  async function handleImport() {
    if (!file || !diff) return
    setImporting(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/admin/simulations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
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
            Upload a JSON file exported from this CMS. Existing slugs will be updated.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
            parseError
              ? 'border-destructive bg-destructive/5'
              : 'border-slate-300 hover:border-teal/40 bg-slate-50'
          )}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={20} className="mx-auto mb-3 text-slate-500" />
          {file ? (
            <p className="text-sm text-slate-900">{file.name}</p>
          ) : (
            <p className="text-sm text-slate-600">Click to select a .json file</p>
          )}
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
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
type SimListItem = {
  slug: string
  title: string
  company: string
  industry: string
  difficulty: 'Foundation' | 'Practitioner' | 'Advanced'
  time: string
  display_order: number
  updated_at: string
}

// Light-theme difficulty badges aligned with config's warm palette
const DIFF_BADGE: Record<string, string> = {
  Foundation: 'bg-emerald-50  text-emerald-700  border-emerald-200',
  Practitioner: 'bg-amber-50    text-amber-700    border-amber-200',
  Advanced: 'bg-rose-50     text-rose-700     border-rose-200',
}

const DIFF_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Foundation', value: 'Foundation' },
  { label: 'Practitioner', value: 'Practitioner' },
  { label: 'Advanced', value: 'Advanced' },
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

      {/* Title + company */}
      <TD className="py-3.5 max-w-xs">
        <Link href={`/admin/simulations/${sim.slug}`} className="group block">
          <span className="font-medium text-[#003359] group-hover:text-teal line-clamp-1 transition-colors">
            {sim.title}
          </span>
          <span className="text-xs text-slate-600 mt-0.5 block">{sim.company}</span>
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
  const [diffFilter, setDiffFilter] = useState('')
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

  async function handleExport() {
    setIsExporting(true)
    try {
      const res = await fetch('/api/admin/simulations/export')
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `simulations-${new Date().toISOString().slice(0, 10)}.json`
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

  const filtered = items.filter(s => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q || s.title?.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q)
    const matchesDiff = !diffFilter || s.difficulty === diffFilter
    return matchesSearch && matchesDiff
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
          <Button
            variant="default"
            size="sm"
            leftIcon={<Download size={13} />}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export all'}
          </Button>
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

          {/* Difficulty filter */}
          <SegmentedControl
            options={DIFF_OPTIONS}
            value={diffFilter}
            onChange={setDiffFilter}
          />
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
                <TH className="pl-3 w-8" />
                <TH className="text-slate-600">Title</TH>
                <TH className="text-slate-600">Industry</TH>
                <TH className="text-slate-600">Difficulty</TH>
                <TH className="text-slate-600">Time</TH>
                <TH className="text-slate-600">Updated</TH>
                <TH className="w-10" />
              </THead>
              <TBody className="divide-y">
                {isLoading ? (
                  <SkeletonRows />
                ) : filtered.length === 0 ? (
                  <TR>
                    <TD colSpan={7} className="bg-white">
                      <EmptyState
                        title="No simulations match your filters"
                        description="Adjust your search or filters to find simulations."
                        action={
                          search || diffFilter
                            ? {
                              label: 'Clear filters',
                              onClick: () => { setSearch(''); setDiffFilter('') },
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
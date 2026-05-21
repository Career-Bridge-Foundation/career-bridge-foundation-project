'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, AlertCircle } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
import { SimulationImportSchema } from '@/lib/schemas/simulation'
import { cn } from '@/lib/cn'

type ImportDiff = { created: number; updated: number; unchanged: number; total: number }

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

function fileToImportBody(file: File, text: string): { raw: unknown; error?: string } {
  if (file.name.endsWith('.csv')) {
    const rows = parseCsvText(text)
    if (rows.length === 0) return { raw: null, error: 'CSV file is empty or has no data rows' }
    return { raw: { simulations: rows.map(row => ({ ...row })) } }
  }
  try {
    return { raw: JSON.parse(text) }
  } catch {
    return { raw: null, error: 'Could not read file — ensure it is valid JSON' }
  }
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null); setDiff(null); setParseError(null); setImporting(false); setDragging(false)
  }

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
    } catch {
      setParseError('Could not read file')
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) processFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]; if (!f) return
    if (!f.name.endsWith('.json') && !f.name.endsWith('.csv')) {
      setParseError('Only .json and .csv files are supported'); return
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
        handleClose(); onDone()
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
          <h2 className="text-base font-semibold text-slate-900">Import simulations</h2>
          <p className="text-sm text-slate-600 mt-1">Upload a JSON or CSV file. Existing slugs will be updated.</p>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file"
          className={cn(
            'rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer select-none',
            parseError ? 'border-destructive bg-destructive/5'
              : dragging ? 'border-teal bg-teal/5'
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
              <p className="text-sm text-slate-700 font-medium">{dragging ? 'Drop to upload' : 'Click or drag a file here'}</p>
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
          <Button variant="primary" size="sm" disabled={!diff || !!parseError || importing} onClick={handleImport}>
            {importing ? 'Importing…' : `Import ${diff ? diff.total : ''} simulations`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function ImportButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Upload size={13} />}
        onClick={() => setOpen(true)}
      >
        Import
      </Button>
      <ImportDialog open={open} onClose={() => setOpen(false)} onDone={() => router.refresh()} />
    </>
  )
}

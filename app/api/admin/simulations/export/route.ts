import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

const META_COLUMNS = [
  'slug', 'title', 'company', 'industry', 'discipline',
  'type', 'difficulty', 'time', 'description', 'display_order',
  'scenario_context',
]

function csvEscape(val: unknown): string {
  const str = val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function tsvEscape(val: unknown): string {
  const str = val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
  return str.replace(/\t/g, '    ').replace(/\r?\n/g, ' ')
}

function buildDelimited(
  rows: Record<string, unknown>[],
  delimiter: ',' | '\t',
  columns?: string[],
): string {
  if (rows.length === 0) return ''
  const headers = columns ?? Object.keys(rows[0])
  const escape = delimiter === ',' ? csvEscape : tsvEscape
  const lines = [
    headers.join(delimiter),
    ...rows.map(row => headers.map(h => escape(row[h])).join(delimiter)),
  ]
  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireStaff()
    if (!ctx.permissions.canExportData) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'json'

  const { data, error } = await supabaseServer
    .from('simulations')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const date = new Date().toISOString().slice(0, 10)

  if (format === 'csv') {
    return new NextResponse(buildDelimited(rows, ','), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="simulations-${date}.csv"`,
      },
    })
  }

  if (format === 'csv-meta') {
    return new NextResponse(buildDelimited(rows, ',', META_COLUMNS), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="simulations-meta-${date}.csv"`,
      },
    })
  }

  if (format === 'tsv') {
    return new NextResponse(buildDelimited(rows, '\t'), {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': `attachment; filename="simulations-${date}.tsv"`,
      },
    })
  }

  // Default: JSON (re-importable format)
  const json = JSON.stringify({ simulations: rows }, null, 2)
  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="simulations-${date}.json"`,
    },
  })
}

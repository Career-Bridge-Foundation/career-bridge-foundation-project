import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET/POST/PATCH /api/admin/partners/[partnerId]/allocation
 *
 * partner_allocations (Spec 15) is the ceiling a partner's sponsor-code
 * minting is checked against (lib/entitlement/ceiling.ts). RLS restricts
 * writes to super_admin — this is the admin-mediated provisioning surface
 * that was missing: without a row here, POST /api/partner/codes returns
 * 'no_active_allocation' and the partner is told to contact us. Only the
 * fields on partner_allocations are handled; nothing here touches
 * sponsor_codes or credit_ledger.
 */

type AllocationBody = {
  committed_credits?: unknown
  buffer_pct?: unknown
  period_start?: unknown
  period_end?: unknown
}

function parseAllocationFields(body: AllocationBody) {
  const { committed_credits, buffer_pct, period_start, period_end } = body

  if (typeof committed_credits !== 'number' || !Number.isInteger(committed_credits) || committed_credits <= 0) {
    return { error: 'committed_credits must be a positive integer' as const }
  }

  const bufferPct = buffer_pct === undefined ? 10 : buffer_pct
  if (typeof bufferPct !== 'number' || !Number.isInteger(bufferPct) || bufferPct < 0) {
    return { error: 'buffer_pct must be a non-negative integer' as const }
  }

  if (typeof period_start !== 'string' || typeof period_end !== 'string') {
    return { error: 'period_start and period_end are required' as const }
  }
  const start = new Date(period_start)
  const end = new Date(period_end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'period_start and period_end must be valid dates' as const }
  }
  if (end <= start) {
    return { error: 'period_end must be after period_start' as const }
  }

  return {
    fields: {
      committed_credits,
      buffer_pct: bufferPct,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    },
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
    const { partnerId } = await params

    const { data, error } = await supabaseServer
      .from('partner_allocations')
      .select('id, committed_credits, buffer_pct, period_start, period_end, created_at')
      .eq('partner_id', partnerId)
      .order('period_start', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ allocations: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
    const { partnerId } = await params

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const parsed = parseAllocationFields((json ?? {}) as AllocationBody)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    // Reject overlapping periods — getAllocationState() uses .maybeSingle()
    // keyed on now() falling within [period_start, period_end], which errors
    // out if two rows for the same partner both match.
    const { data: overlapping, error: overlapErr } = await supabaseServer
      .from('partner_allocations')
      .select('id, period_start, period_end')
      .eq('partner_id', partnerId)
      .lt('period_start', parsed.fields.period_end)
      .gt('period_end', parsed.fields.period_start)

    if (overlapErr) {
      return NextResponse.json({ error: overlapErr.message }, { status: 500 })
    }
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: `Overlaps an existing allocation period (${overlapping[0].period_start} – ${overlapping[0].period_end})` },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseServer
      .from('partner_allocations')
      .insert({ partner_id: partnerId, ...parsed.fields })
      .select('id, committed_credits, buffer_pct, period_start, period_end, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ allocation: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
    const { partnerId } = await params

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const body = (json ?? {}) as AllocationBody & { id?: unknown }
    if (typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const parsed = parseAllocationFields(body)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { data: overlapping, error: overlapErr } = await supabaseServer
      .from('partner_allocations')
      .select('id, period_start, period_end')
      .eq('partner_id', partnerId)
      .neq('id', body.id)
      .lt('period_start', parsed.fields.period_end)
      .gt('period_end', parsed.fields.period_start)

    if (overlapErr) {
      return NextResponse.json({ error: overlapErr.message }, { status: 500 })
    }
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: `Overlaps an existing allocation period (${overlapping[0].period_start} – ${overlapping[0].period_end})` },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseServer
      .from('partner_allocations')
      .update(parsed.fields)
      .eq('id', body.id)
      .eq('partner_id', partnerId)
      .select('id, committed_credits, buffer_pct, period_start, period_end, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ allocation: data })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { effectiveCodeStatus, type EffectiveCodeStatus } from '@/lib/entitlement/codeStatus'
import { formatCodeForDisplay } from '@/lib/entitlement/sponsorCode'

export const runtime = 'nodejs'

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 200

/**
 * GET /api/partner/codes
 *
 * Lists sponsor codes for the authenticated partner. Filters: status
 * (effective — active/exhausted/revoked/expired), cohort_id, batch_id.
 * Paginated via limit/offset. Includes redemption_count and
 * reserved_remaining per code (Spec 18's GET /api/partner/codes extension).
 */
export async function GET(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status') as EffectiveCodeStatus | null
    const cohortFilter = url.searchParams.get('cohort_id')
    const batchFilter = url.searchParams.get('batch_id')
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(url.searchParams.get('limit')) || PAGE_SIZE_DEFAULT))
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

    let query = supabaseServer
      .from('sponsor_codes')
      .select(
        'id, code, label, batch_id, prefix, credits_per_redemption, max_redemptions, redemptions_used, cohort_id, expires_at, created_at, created_by, revoked_at, revoked_by, note, status',
        { count: 'exact' },
      )
      .eq('partner_id', ctx.partnerId!)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (cohortFilter) query = query.eq('cohort_id', cohortFilter)
    if (batchFilter) query = query.eq('batch_id', batchFilter)

    const { data, count, error } = await query
    if (error) throw error

    let codes = (data ?? []).map((row) => {
      const status = effectiveCodeStatus(row as { status: 'active' | 'exhausted' | 'revoked'; expires_at: string })
      const reservedRemaining =
        ((row.max_redemptions as number) - (row.redemptions_used as number)) * (row.credits_per_redemption as number)
      return {
        ...row,
        display_code: row.prefix ? formatCodeForDisplay(row.code as string, row.prefix as string) : (row.code as string).toUpperCase(),
        status,
        redemption_count: row.redemptions_used,
        reserved_remaining: status === 'active' ? reservedRemaining : 0,
      }
    })

    // Effective status includes the derived 'expired' state, which isn't a
    // column — filter in application code rather than in the query above.
    if (statusFilter) {
      codes = codes.filter((c) => c.status === statusFilter)
    }

    return NextResponse.json({ codes, total: count ?? codes.length })
  } catch (err) {
    console.error('[partner/codes GET] failed', err)
    return NextResponse.json({ error: 'could not load codes' }, { status: 500 })
  }
}

/**
 * POST /api/partner/codes
 *
 * Mints sponsor code(s) for the authenticated partner via the atomic
 * mint_sponsor_codes() RPC (schema-reference/spec-18-mint-rpc.sql), which
 * locks the partner's allocation row, checks ceiling headroom, and
 * generates code(s) — all inside one transaction (Spec 18: a unique batch
 * mints all N or none; concurrent mints can't together exceed ceiling).
 *
 * Body: {
 *   shape                    'shared' | 'unique'   required
 *   label                    string                required — partner-facing batch name
 *   prefix                   string                required — uppercase alphanumeric, <=8 chars
 *   credits_per_redemption   integer               required — credits per candidate
 *   quantity                 integer               required — redemptions (shared) or code count (unique)
 *   cohort_id                string                optional
 *   expires_at               string (ISO)          required, future date
 *   note                     string                optional
 * }
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const {
      shape, label, prefix, credits_per_redemption, quantity, cohort_id, expires_at, note,
    } = body as {
      shape?: unknown
      label?: unknown
      prefix?: unknown
      credits_per_redemption?: unknown
      quantity?: unknown
      cohort_id?: unknown
      expires_at?: unknown
      note?: unknown
    }

    if (shape !== 'shared' && shape !== 'unique') {
      return NextResponse.json({ error: "shape must be 'shared' or 'unique'" }, { status: 400 })
    }
    if (typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }
    if (typeof prefix !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(prefix)) {
      return NextResponse.json({ error: 'prefix must be 1-8 alphanumeric characters' }, { status: 400 })
    }
    if (!Number.isInteger(credits_per_redemption) || (credits_per_redemption as number) < 1) {
      return NextResponse.json({ error: 'credits_per_redemption must be a positive integer' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || (quantity as number) < 1) {
      return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
    }
    if (typeof expires_at !== 'string' || !expires_at) {
      return NextResponse.json({ error: 'expires_at required' }, { status: 400 })
    }
    const expiresDate = new Date(expires_at)
    if (isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
      return NextResponse.json({ error: 'expires_at must be a valid future date' }, { status: 400 })
    }
    if (cohort_id !== undefined && cohort_id !== null && typeof cohort_id !== 'string') {
      return NextResponse.json({ error: 'cohort_id must be a UUID string' }, { status: 400 })
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      return NextResponse.json({ error: 'note must be a string' }, { status: 400 })
    }

    if (cohort_id) {
      const { data: cohort } = await supabaseServer
        .from('cohorts')
        .select('id')
        .eq('id', cohort_id)
        .eq('partner_id', ctx.partnerId!)
        .maybeSingle()
      if (!cohort) {
        return NextResponse.json({ error: 'cohort not found' }, { status: 404 })
      }
    }

    const { data: result, error: rpcError } = await supabaseServer.rpc('mint_sponsor_codes', {
      p_partner_id: ctx.partnerId!,
      p_shape: shape,
      p_label: (label as string).trim(),
      p_prefix: (prefix as string).toUpperCase(),
      p_credits_per_redemption: credits_per_redemption as number,
      p_quantity: quantity as number,
      p_cohort_id: cohort_id ?? null,
      p_expires_at: expiresDate.toISOString(),
      p_note: (note as string | undefined)?.trim() || null,
      p_minted_by: ctx.userId,
    })

    if (rpcError) {
      console.error('[partner/codes POST] rpc error', rpcError)
      return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }

    const rpc = result as {
      success: boolean
      code?: string
      shortfall?: number
      remaining?: number
      batch_id?: string
      codes?: { id: string; code: string }[]
      reserved?: number
    }

    if (!rpc.success) {
      if (rpc.code === 'no_active_allocation') {
        return NextResponse.json(
          { error: 'no active allocation — contact Evidentize to set up your credit ceiling' },
          { status: 422 },
        )
      }
      if (rpc.code === 'ceiling_exceeded') {
        return NextResponse.json(
          {
            error: `minting this would reserve credits exceeding your ceiling by ${rpc.shortfall} — ${rpc.remaining} remain available`,
            code: 'ceiling_exceeded',
            shortfall: rpc.shortfall,
            remaining: rpc.remaining,
          },
          { status: 422 },
        )
      }
      return NextResponse.json({ error: rpc.code ?? 'mint failed' }, { status: 422 })
    }

    return NextResponse.json(
      { batch_id: rpc.batch_id ?? null, codes: rpc.codes ?? [], reserved: rpc.reserved },
      { status: 201 },
    )
  } catch (err) {
    console.error('[partner/codes POST] failed', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

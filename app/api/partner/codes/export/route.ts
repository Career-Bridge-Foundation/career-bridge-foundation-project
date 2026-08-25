import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { effectiveCodeStatus, type EffectiveCodeStatus } from '@/lib/entitlement/codeStatus'
import { formatCodeForDisplay } from '@/lib/entitlement/sponsorCode'

export const runtime = 'nodejs'

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * GET /api/partner/codes/export
 *
 * CSV for a batch or a filtered set. The unique-batch mint result screen
 * offers this as a one-click way to grab the whole freshly-minted batch —
 * codes are not one-time-reveal and remain exportable from the list at any
 * time via the same filters as GET /api/partner/codes.
 *
 * Query: status?, cohort_id?, batch_id?
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

    let query = supabaseServer
      .from('sponsor_codes')
      .select('code, prefix, label, credits_per_redemption, max_redemptions, redemptions_used, cohort_id, expires_at, status')
      .eq('partner_id', ctx.partnerId!)
      .order('created_at', { ascending: false })

    if (cohortFilter) query = query.eq('cohort_id', cohortFilter)
    if (batchFilter) query = query.eq('batch_id', batchFilter)

    const { data, error } = await query
    if (error) throw error

    let rows = data ?? []
    if (statusFilter) {
      rows = rows.filter(
        (r) => effectiveCodeStatus(r as { status: 'active' | 'exhausted' | 'revoked'; expires_at: string }) === statusFilter,
      )
    }

    const header = ['code', 'label', 'credits_per_redemption', 'expiry', 'cohort_id', 'status']
    const lines = [header.join(',')]

    for (const row of rows) {
      const displayCode = row.prefix
        ? formatCodeForDisplay(row.code as string, row.prefix as string)
        : (row.code as string).toUpperCase()
      const status = effectiveCodeStatus(row as { status: 'active' | 'exhausted' | 'revoked'; expires_at: string })
      lines.push(
        [
          csvEscape(displayCode),
          csvEscape((row.label as string | null) ?? ''),
          String(row.credits_per_redemption),
          csvEscape(new Date(row.expires_at as string).toISOString()),
          csvEscape((row.cohort_id as string | null) ?? ''),
          status,
        ].join(','),
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sponsor-codes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[partner/codes/export GET] failed', err)
    return NextResponse.json({ error: 'could not export codes' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/partner/codes/batch/:batch_id/revoke
 *
 * Revokes every code sharing a batch_id in one update — Spec 18: "Revokes
 * an entire unique-code batch in one transaction." Already-redeemed
 * credits are untouched (same rule as the single-code revoke); only
 * unrevoked rows in the batch are affected, and this is idempotent.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { batchId } = await params

  try {
    const { data: batchRows } = await supabaseServer
      .from('sponsor_codes')
      .select('id')
      .eq('batch_id', batchId)
      .eq('partner_id', ctx.partnerId!)

    if (!batchRows?.length) {
      return NextResponse.json({ error: 'batch not found' }, { status: 404 })
    }

    const { data: updated, error: updateError } = await supabaseServer
      .from('sponsor_codes')
      .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId, status: 'revoked' })
      .eq('batch_id', batchId)
      .eq('partner_id', ctx.partnerId!)
      .is('revoked_at', null)
      .select('id')

    if (updateError) {
      console.error('[partner/codes/batch/revoke] update failed', updateError)
      return NextResponse.json({ error: 'could not revoke batch' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, revoked_count: updated?.length ?? 0 })
  } catch (err) {
    console.error('[partner/codes/batch/revoke] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

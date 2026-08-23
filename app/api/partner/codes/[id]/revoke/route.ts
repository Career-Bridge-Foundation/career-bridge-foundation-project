import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/partner/codes/[id]/revoke
 *
 * Revokes a sponsor code by setting revoked_at. The code must belong to the
 * authenticated partner — partner_id is forced from ctx, never the request body.
 *
 * Already-redeemed credits are NOT affected — candidates keep credits they have
 * already received. Revocation only prevents future redemptions.
 *
 * An already-revoked code returns 200 (idempotent).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const { data: code } = await supabaseServer
      .from('sponsor_codes')
      .select('id, revoked_at')
      .eq('id', id)
      .eq('partner_id', ctx.partnerId!)  // scoped to this partner — cannot revoke another partner's code
      .maybeSingle()

    if (!code) {
      return NextResponse.json({ error: 'code not found' }, { status: 404 })
    }

    // Idempotent — already revoked is fine
    if (code.revoked_at) {
      return NextResponse.json({ ok: true, already_revoked: true })
    }

    const { error: updateError } = await supabaseServer
      .from('sponsor_codes')
      .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId, status: 'revoked' })
      .eq('id', id)
      .eq('partner_id', ctx.partnerId!)

    if (updateError) {
      console.error('[partner/codes/revoke] update failed', updateError)
      return NextResponse.json({ error: 'could not revoke code' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[partner/codes/revoke] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

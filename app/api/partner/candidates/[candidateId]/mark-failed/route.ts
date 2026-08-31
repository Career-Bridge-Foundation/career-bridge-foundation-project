import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { notifyProvisioningFailed } from '@/lib/partners/notifyProvisioningFailed'

export const runtime = 'nodejs'

/**
 * POST /api/partner/candidates/[candidateId]/mark-failed — records a
 * terminal provisioning failure and fires the partner-admin alert (Spec 19
 * notifications table). Manual today (no automated worker exists yet to
 * call this on its own), but the state transition and the alert it
 * triggers are exactly what a future worker's own failure path would do —
 * this isn't a stopgap shape, it's the real one.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { candidateId } = await params

  const { data: ents } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id')
    .eq('granted_by_partner', ctx.partnerId!)
    .eq('candidate_id', candidateId)
    .is('revoked_at', null)
    .limit(1)
  if (!ents?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: current } = await supabaseServer
    .from('portfolio_profiles')
    .select('provisioning_attempts')
    .eq('id', candidateId)
    .maybeSingle()

  const { error } = await supabaseServer
    .from('portfolio_profiles')
    .update({
      provisioning_status: 'failed',
      provisioning_attempts: ((current?.provisioning_attempts as number | null) ?? 0) + 1,
      last_provisioning_attempt_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  if (error) {
    console.error('[mark-failed] update failed', error.message)
    return NextResponse.json({ error: 'could not update provisioning status' }, { status: 500 })
  }

  await notifyProvisioningFailed(candidateId, ctx.partnerId!)

  return NextResponse.json({ ok: true })
}

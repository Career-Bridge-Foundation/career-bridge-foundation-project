import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/partner/candidates/[candidateId]/provision — matches Spec 19's
 * named API surface ("manual re-send"). NO Circle API integration exists
 * yet (Spec 19.3 deferred) — this is a plain flag flip to 'pending' plus an
 * attempt counter, not a working retry. Its purpose is to exist at the
 * right shape now so a future queued provisioning worker has something to
 * pick up; do not read a 200 from this route as "provisioning happened."
 * The only endpoint that currently changes real state is mark-provisioned
 * (sibling route), which is why it's the one wired into the console UI.
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
      provisioning_status: 'pending',
      provisioning_attempts: ((current?.provisioning_attempts as number | null) ?? 0) + 1,
      last_provisioning_attempt_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  if (error) {
    console.error('[provision] update failed', error.message)
    return NextResponse.json({ error: 'could not update provisioning status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

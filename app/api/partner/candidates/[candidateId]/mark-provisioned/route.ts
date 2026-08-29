import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/partner/candidates/[candidateId]/mark-provisioned — Spec 19
 * decision 10: manual marking is a permanent fallback, not a stopgap for
 * while Circle isn't wired up. A partner admin who added the candidate to
 * their community by hand tells the platform here; no Circle API call
 * happens from this route.
 *
 * Ownership gate matches the existing country-correction endpoint
 * (app/api/partner/candidates/[candidateId]/route.ts): candidate must be
 * currently entitled by THIS partner, checked before any write.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { candidateId } = await params

  let json: unknown
  try {
    json = await request.json().catch(() => ({}))
  } catch {
    json = {}
  }
  const memberId = (json as { community_member_id?: unknown })?.community_member_id
  if (memberId !== undefined && typeof memberId !== 'string') {
    return NextResponse.json({ error: 'community_member_id must be a string' }, { status: 400 })
  }

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

  const updates: Record<string, string | null> = {
    provisioning_status: 'provisioned',
    last_provisioning_attempt_at: new Date().toISOString(),
  }
  if (memberId) updates.community_member_id = memberId

  const { error } = await supabaseServer
    .from('portfolio_profiles')
    .update(updates)
    .eq('id', candidateId)

  if (error) {
    console.error('[mark-provisioned] update failed', error.message)
    return NextResponse.json({ error: 'could not update provisioning status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/partner/codes/:id/redemptions
 *
 * Redemption events for one code, scoped to the partner's own candidates
 * (Spec 18: "A partner-admin can see, per code: which of their candidates
 * redeemed it, when, and how many credits landed. They cannot see what
 * those credits were subsequently spent on" — this endpoint returns
 * exactly that and nothing from credit_ledger beyond the grant itself).
 */
export async function GET(
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
    // Scope gate: the code must belong to this partner.
    const { data: code } = await supabaseServer
      .from('sponsor_codes')
      .select('id')
      .eq('id', id)
      .eq('partner_id', ctx.partnerId!)
      .maybeSingle()

    if (!code) {
      return NextResponse.json({ error: 'code not found' }, { status: 404 })
    }

    const { data: redemptions, error } = await supabaseServer
      .from('code_redemptions')
      .select('id, candidate_id, credits_granted, created_at')
      .eq('code_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const candidateIds = [...new Set((redemptions ?? []).map((r) => r.candidate_id as string))]
    if (!candidateIds.length) {
      return NextResponse.json({ redemptions: [] })
    }

    const { data: profiles } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, user_id, slug')
      .in('id', candidateIds)

    const userIdByCandidateId = new Map(
      (profiles ?? []).map((p) => [p.id as string, p.user_id as string]),
    )
    const inScopeUserIds = [...userIdByCandidateId.values()]

    const { data: people } = await supabaseServer
      .from('profiles')
      .select('id, full_name')
      .in('id', inScopeUserIds)
    const nameByUserId = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string | null]))

    const rows = (redemptions ?? []).map((r) => {
      const userId = userIdByCandidateId.get(r.candidate_id as string)
      return {
        candidate_id: r.candidate_id,
        candidate_name: userId ? nameByUserId.get(userId) ?? null : null,
        credits_granted: r.credits_granted,
        redeemed_at: r.created_at,
      }
    })

    return NextResponse.json({ redemptions: rows })
  } catch (err) {
    console.error('[partner/codes/redemptions GET] failed', err)
    return NextResponse.json({ error: 'could not load redemptions' }, { status: 500 })
  }
}

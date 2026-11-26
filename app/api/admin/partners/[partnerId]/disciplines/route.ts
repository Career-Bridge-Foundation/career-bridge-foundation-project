import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { grantableDisciplines } from '@/lib/disciplines-data'
import { getPartnerDisciplineRange } from '@/lib/partners/disciplineRange'

export const runtime = 'nodejs'

/**
 * GET/PUT /api/admin/partners/[partnerId]/disciplines — Spec 20.
 *
 * The discipline RANGE a partner may grant (partner_disciplines). An empty
 * range means UNRESTRICTED — every grantable discipline.
 *
 * Narrowing the range also soft-revokes this partner's active
 * candidate_entitlements outside the new range (revoked_reason
 * 'partner_discipline_removed'). A candidate mid-simulation in a revoked
 * discipline can still finish that attempt — the /simulate gate lets an
 * in_progress session resume (lib/access-control.ts) — but cannot start or
 * retry one.
 *
 * NOT ATOMIC: the range is written first, then entitlements are revoked.
 * If the second step fails the range is already narrowed (so no NEW grants
 * can happen outside it); the response reports the failure and a re-PUT of
 * the same range retries the revocation, since it is idempotent.
 */

const GRANTABLE_SLUGS = new Set(grantableDisciplines.map((d) => d.slug))

type Impact = Record<string, { candidates: number; inProgress: number }>

/** Per-discipline count of this partner's active candidates, and how many are mid-simulation. */
async function getImpact(partnerId: string): Promise<Impact> {
  const { data: ents, error } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id, discipline')
    .eq('granted_by_partner', partnerId)
    .is('revoked_at', null)
  if (error) throw error

  const impact: Impact = {}
  for (const e of ents ?? []) {
    impact[e.discipline] ??= { candidates: 0, inProgress: 0 }
    impact[e.discipline].candidates++
  }

  const candidateIds = [...new Set((ents ?? []).map((e) => e.candidate_id as string))]
  if (!candidateIds.length) return impact

  const { data: profs, error: profErr } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id')
    .in('id', candidateIds)
  if (profErr) throw profErr
  const candidateByUser = new Map((profs ?? []).map((p) => [p.user_id as string, p.id as string]))
  if (!candidateByUser.size) return impact

  const { data: sessions, error: sessErr } = await supabaseServer
    .from('simulation_sessions')
    .select('user_id, discipline')
    .in('user_id', [...candidateByUser.keys()])
    .eq('status', 'in_progress')
  if (sessErr) throw sessErr

  // Only count a session where THIS partner entitled that candidate in that discipline.
  const entitled = new Set((ents ?? []).map((e) => `${e.candidate_id}:${e.discipline}`))
  const counted = new Set<string>()
  for (const s of sessions ?? []) {
    const candidateId = candidateByUser.get(s.user_id as string)
    const key = `${candidateId}:${s.discipline}`
    if (!candidateId || !entitled.has(key) || counted.has(key)) continue
    counted.add(key)
    impact[s.discipline as string].inProgress++
  }
  return impact
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { partnerId } = await params
    const [range, impact] = await Promise.all([getPartnerDisciplineRange(partnerId), getImpact(partnerId)])
    return NextResponse.json({
      restricted: range.restricted,
      disciplines: range.restricted ? range.slugs : [],
      impact,
    })
  } catch (err) {
    console.error('[admin/partners/disciplines GET]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  let ctx
  try {
    ctx = await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { partnerId } = await params

    const body = await request.json().catch(() => null)
    const requested = (body as { disciplines?: unknown } | null)?.disciplines
    if (!Array.isArray(requested) || !requested.every((d) => typeof d === 'string')) {
      return NextResponse.json({ error: 'disciplines must be an array of discipline slugs' }, { status: 400 })
    }
    const desired = [...new Set(requested as string[])]
    const unknown = desired.filter((d) => !GRANTABLE_SLUGS.has(d))
    if (unknown.length) {
      return NextResponse.json({ error: `unknown or non-grantable discipline: ${unknown.join(', ')}` }, { status: 400 })
    }

    const { data: partner } = await supabaseServer.from('partners').select('id').eq('id', partnerId).maybeSingle()
    if (!partner) return NextResponse.json({ error: 'partner not found' }, { status: 404 })

    const now = new Date().toISOString()

    // ── 1. RANGE — reactivate/insert desired, soft-revoke the rest ──
    if (desired.length) {
      const { error: upErr } = await supabaseServer
        .from('partner_disciplines')
        .upsert(
          desired.map((discipline) => ({
            partner_id: partnerId,
            discipline,
            granted_by: ctx.userId,
            granted_at: now,
            revoked_at: null,
            revoked_by: null,
          })),
          { onConflict: 'partner_id,discipline', ignoreDuplicates: false }
        )
      if (upErr) {
        console.error('[admin/partners/disciplines PUT] range upsert failed', upErr)
        return NextResponse.json({ error: 'could not update disciplines' }, { status: 500 })
      }
    }

    let revokeRange = supabaseServer
      .from('partner_disciplines')
      .update({ revoked_at: now, revoked_by: ctx.userId })
      .eq('partner_id', partnerId)
      .is('revoked_at', null)
    if (desired.length) revokeRange = revokeRange.not('discipline', 'in', `(${desired.join(',')})`)
    const { error: revRangeErr } = await revokeRange
    if (revRangeErr) {
      console.error('[admin/partners/disciplines PUT] range revoke failed', revRangeErr)
      return NextResponse.json({ error: 'could not update disciplines' }, { status: 500 })
    }

    // ── 2. ENTITLEMENTS — empty range is unrestricted, so nothing to revoke ──
    let revokedEntitlements = 0
    if (desired.length) {
      const { data: revoked, error: revEntErr } = await supabaseServer
        .from('candidate_entitlements')
        .update({ revoked_at: now, revoked_by: ctx.userId, revoked_reason: 'partner_discipline_removed' })
        .eq('granted_by_partner', partnerId)
        .is('revoked_at', null)
        .not('discipline', 'in', `(${desired.join(',')})`)
        .select('id')
      if (revEntErr) {
        console.error('[admin/partners/disciplines PUT] entitlement revoke failed', revEntErr)
        return NextResponse.json(
          {
            error: 'Disciplines saved, but revoking candidate access failed — save again to retry.',
            partial: true,
          },
          { status: 500 }
        )
      }
      revokedEntitlements = revoked?.length ?? 0
    }

    return NextResponse.json({
      restricted: desired.length > 0,
      disciplines: desired,
      revokedEntitlements,
    })
  } catch (err) {
    console.error('[admin/partners/disciplines PUT]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

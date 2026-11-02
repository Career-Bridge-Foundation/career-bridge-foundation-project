import { NextResponse } from 'next/server'
import { getCurrentUserRole, type RoleContext } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { getPartnerDisciplineRange, isInRange } from '@/lib/partners/disciplineRange'

export const runtime = 'nodejs'

/**
 * GET/PUT /api/partner/candidates/:id/disciplines — Spec 20.
 *
 * A partner (or one of its mentors, for candidates assigned to them) edits
 * which disciplines THIS partner grants an already-redeemed candidate, with
 * no new invite email and no credit cost.
 *
 * Tenant gate mirrors ../country/route.ts: the candidate must hold an ACTIVE
 * entitlement from this partner (which only exists after redemption, so
 * pending invites are never editable here), checked BEFORE any write — an
 * unknown/foreign id is a 404. Mentors are additionally limited to their
 * mentor_candidates assignments. partner_id is always FORCED from the
 * session.
 *
 * Only this partner's own grants are added or revoked. A discipline the
 * candidate holds from ANOTHER partner is read-only here.
 *
 * Revoking a discipline the candidate is mid-simulation in still lets them
 * finish that attempt (the /simulate gate resumes in_progress sessions —
 * lib/access-control.ts) but not start or retry one.
 *
 * NOT ATOMIC: adds then revokes, row by row; per-discipline failures are
 * reported in `failed` so the partner can simply save again.
 */

type Scope = { ctx: RoleContext; partnerId: string; candidateId: string; candidateUserId: string }

async function resolveScope(candidateId: string): Promise<Scope | NextResponse> {
  const ctx = await getCurrentUserRole()
  if (!ctx || (ctx.role !== 'partner' && ctx.role !== 'mentor') || !ctx.partnerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const partnerId = ctx.partnerId
  const notFound = NextResponse.json({ error: 'candidate not found' }, { status: 404 })

  // ── GATE: candidate must be entitled BY THIS PARTNER, active ──
  const { data: ents } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id')
    .eq('granted_by_partner', partnerId)
    .eq('candidate_id', candidateId)
    .is('revoked_at', null)
    .limit(1)
  if (!ents?.length) return notFound

  const { data: profile } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id')
    .eq('id', candidateId)
    .maybeSingle()
  if (!profile) return notFound

  if (ctx.role === 'mentor') {
    const { data: assigned } = await supabaseServer
      .from('mentor_candidates')
      .select('candidate_user_id')
      .eq('mentor_user_id', ctx.userId)
      .eq('partner_id', partnerId)
      .eq('candidate_user_id', profile.user_id)
      .is('revoked_at', null)
      .limit(1)
    if (!assigned?.length) return notFound
  }

  return { ctx, partnerId, candidateId, candidateUserId: profile.user_id as string }
}

async function loadState(scope: Scope) {
  const [range, { data: ents, error: entErr }, { data: sessions, error: sessErr }] = await Promise.all([
    getPartnerDisciplineRange(scope.partnerId),
    supabaseServer
      .from('candidate_entitlements')
      .select('discipline, granted_by_partner, requires_programme_terms')
      .eq('candidate_id', scope.candidateId)
      .is('revoked_at', null),
    supabaseServer
      .from('simulation_sessions')
      .select('discipline')
      .eq('user_id', scope.candidateUserId)
      .eq('status', 'in_progress'),
  ])
  if (entErr) throw entErr
  if (sessErr) throw sessErr

  const active = ents ?? []
  return {
    range,
    mine: active.filter((e) => e.granted_by_partner === scope.partnerId).map((e) => e.discipline as string),
    otherPartners: active.filter((e) => e.granted_by_partner !== scope.partnerId).map((e) => e.discipline as string),
    inProgress: [...new Set((sessions ?? []).map((s) => s.discipline as string).filter(Boolean))],
    // New grants inherit this partner's existing programme-terms choice for the candidate.
    requiresProgrammeTerms:
      active.find((e) => e.granted_by_partner === scope.partnerId)?.requires_programme_terms ?? true,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const { candidateId } = await params
    const scope = await resolveScope(candidateId)
    if (scope instanceof NextResponse) return scope

    const state = await loadState(scope)
    return NextResponse.json({
      range: state.range.slugs,
      mine: state.mine,
      otherPartners: state.otherPartners,
      inProgress: state.inProgress,
    })
  } catch (err) {
    console.error('[partner/candidates/disciplines GET]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/** Grant one discipline from this partner — reactivates an existing row rather than duplicating it. */
async function grant(scope: Scope, discipline: string, requiresProgrammeTerms: boolean): Promise<string | null> {
  const now = new Date().toISOString()
  const reactivate = {
    granted_by_partner: scope.partnerId,
    granted_at: now,
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
  }

  // Prefer this partner's own previously-revoked row (keeps its history).
  const { data: own, error: ownErr } = await supabaseServer
    .from('candidate_entitlements')
    .update(reactivate)
    .eq('candidate_id', scope.candidateId)
    .eq('discipline', discipline)
    .eq('granted_by_partner', scope.partnerId)
    .select('id')
  if (ownErr) return ownErr.message
  if (own?.length) return null

  const { error: insErr } = await supabaseServer.from('candidate_entitlements').insert({
    candidate_id: scope.candidateId,
    discipline,
    granted_by_partner: scope.partnerId,
    requires_programme_terms: requiresProgrammeTerms,
  })
  if (!insErr) return null
  if (insErr.code !== '23505') return insErr.message

  // Unique on (candidate_id, discipline) in production: a REVOKED row from
  // another partner occupies the slot. Take it over (the active case was
  // rejected before we got here, and .not('revoked_at', 'is', null) keeps
  // it that way under a race).
  const { data: taken, error: takeErr } = await supabaseServer
    .from('candidate_entitlements')
    .update({ ...reactivate, requires_programme_terms: requiresProgrammeTerms })
    .eq('candidate_id', scope.candidateId)
    .eq('discipline', discipline)
    .not('revoked_at', 'is', null)
    .select('id')
  if (takeErr) return takeErr.message
  return taken?.length ? null : 'already granted by another organisation'
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const { candidateId } = await params
    const scope = await resolveScope(candidateId)
    if (scope instanceof NextResponse) return scope

    const body = await request.json().catch(() => null)
    const requested = (body as { disciplines?: unknown } | null)?.disciplines
    if (!Array.isArray(requested) || !requested.every((d) => typeof d === 'string')) {
      return NextResponse.json({ error: 'disciplines must be an array of discipline slugs' }, { status: 400 })
    }
    const desired = [...new Set(requested as string[])]

    // At least one — a candidate with no active grant from this partner drops
    // off the roster entirely and could no longer be edited from here.
    if (desired.length === 0) {
      return NextResponse.json(
        { error: 'Keep at least one discipline. A candidate with none would leave your roster.' },
        { status: 400 },
      )
    }

    const state = await loadState(scope)

    const outOfRange = desired.filter((d) => !isInRange(state.range, d))
    if (outOfRange.length) {
      return NextResponse.json(
        { error: `Your organisation isn't set up for: ${outOfRange.join(', ')}` },
        { status: 400 },
      )
    }

    const toAdd = desired.filter((d) => !state.mine.includes(d))
    const toRemove = state.mine.filter((d) => !desired.includes(d))

    const heldElsewhere = toAdd.filter((d) => state.otherPartners.includes(d))
    if (heldElsewhere.length) {
      return NextResponse.json(
        { error: `Already granted by another organisation: ${heldElsewhere.join(', ')}` },
        { status: 409 },
      )
    }

    const failed: { discipline: string; error: string }[] = []

    for (const discipline of toAdd) {
      const err = await grant(scope, discipline, state.requiresProgrammeTerms)
      if (err) failed.push({ discipline, error: err })
    }

    if (toRemove.length) {
      const { error: revErr } = await supabaseServer
        .from('candidate_entitlements')
        .update({ revoked_at: new Date().toISOString(), revoked_by: scope.ctx.userId, revoked_reason: 'partner_edit' })
        .eq('candidate_id', scope.candidateId)
        .eq('granted_by_partner', scope.partnerId)
        .in('discipline', toRemove)
        .is('revoked_at', null)
      if (revErr) for (const discipline of toRemove) failed.push({ discipline, error: revErr.message })
    }

    if (failed.length) {
      console.error('[partner/candidates/disciplines PUT] partial failure', { candidateId, failed })
    }

    const after = await loadState(scope)
    return NextResponse.json(
      { mine: after.mine, added: toAdd, removed: toRemove, failed },
      { status: failed.length ? 207 : 200 },
    )
  } catch (err) {
    console.error('[partner/candidates/disciplines PUT]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

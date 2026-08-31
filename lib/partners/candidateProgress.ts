import { supabaseServer } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Shared candidate-progress primitive (Spec 05.8).
//
// Returns the candidates a partner has ENTITLED, with their simulation progress,
// scoped strictly to that partner. Built on columns VERIFIED against production
// (NOT the migration files, which are out of sync):
//
//   partners.id
//     → candidate_entitlements.granted_by_partner (= partnerId, revoked_at IS NULL)
//     → candidate_entitlements.candidate_id = portfolio_profiles.id
//     → portfolio_profiles.user_id = auth.users.id        (NOT candidate_user_id)
//         ↳ profiles.full_name   (profiles.id = portfolio_profiles.user_id)
//         ↳ auth.users.email     (service-role admin API)
//     → LEFT JOIN simulation_sessions ON user_id
//     → LEFT JOIN evaluation_results  ON user_id (matched by session id)
//
// SECURITY: uses the service-role client (supabaseServer), which BYPASSES RLS.
// The partnerId scope in resolvePartnerRoster() Step 1 is therefore the SOLE
// control preventing cross-partner data exposure — there is no RLS backstop.
// This function TRUSTS the partnerId it is given; the caller is responsible for
// supplying the authenticated partner's own id (e.g. via requirePartner(), or the
// 05.10 mentor resolver) and must NEVER pass a partnerId derived from user input.
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateSimulationProgress = {
  simulationSlug: string
  discipline: string | null
  status: string | null        // simulation_sessions.status; null = no session
  startedAt: string | null
  submittedAt: string | null
  verdictBand: string | null   // evaluation_results.verdict_band; null = not evaluated
  overallScore: number | null
  evaluatedAt: string | null
}

export type PartnerCandidate = {
  candidateId: string          // portfolio_profiles.id (= candidate_entitlements.candidate_id)
  userId: string               // portfolio_profiles.user_id (= auth.users.id)
  slug: string                 // portfolio_profiles.slug
  fullName: string | null      // profiles.full_name
  email: string | null         // auth.users.email (service-role)
  disciplines: string[]        // ACTIVE entitlement disciplines for THIS partner
}

// Acceptance status (Spec 19) is a SEPARATE, optional overlay — fetched only by
// the partner roster page (lib/partners/candidateAcceptanceStatus.ts), never by
// the mentor view. Left undefined rather than fetched-but-hidden so there's no
// query cost for a column mentors never see.
export type PartnerCandidateWithProgress = PartnerCandidate & {
  simulations: CandidateSimulationProgress[]
  platformTermsAccepted?: boolean
  programmeTermsAccepted?: boolean
}

/**
 * The single scoped entry point. Both public functions route through here, so
 * there is exactly one place that introduces candidates into a result — Step 1,
 * which is scoped to `granted_by_partner = partnerId AND revoked_at IS NULL`.
 *
 * `opts.candidateUserIds`, when supplied, NARROWS within the partner scope: it is
 * applied as a filter AFTER partner scoping and is never used as a scope key. A
 * requested id belonging to another partner's candidate is simply absent from the
 * partner-scoped set, so it returns nothing (partner scope dominates).
 */
async function resolvePartnerRoster(
  partnerId: string,
  opts?: { candidateUserIds?: string[] }
): Promise<PartnerCandidate[]> {
  // ── STEP 1 — ISOLATION BOUNDARY: the only query that introduces candidates ──
  const { data: ents, error: entErr } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id, discipline')
    .eq('granted_by_partner', partnerId)
    .is('revoked_at', null)
  if (entErr) throw entErr
  if (!ents?.length) return []

  // Dedupe by candidate_id; aggregate entitled disciplines per candidate.
  const discByCandidate = new Map<string, Set<string>>()
  for (const e of ents) {
    if (!e.candidate_id) continue
    const set = discByCandidate.get(e.candidate_id) ?? new Set<string>()
    if (e.discipline) set.add(e.discipline)
    discByCandidate.set(e.candidate_id, set)
  }
  const scopedCandidateIds = [...discByCandidate.keys()]
  if (!scopedCandidateIds.length) return []

  // ── STEP 2 — resolve profiles ONLY for scoped candidate_ids ──
  // (ids derived exclusively from Step 1 — no external id list reaches a query)
  const { data: profs, error: profErr } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id, slug')
    .in('id', scopedCandidateIds)
  if (profErr) throw profErr

  let roster: PartnerCandidate[] = (profs ?? []).map((p) => ({
    candidateId: p.id as string,
    userId: p.user_id as string,
    slug: p.slug as string,
    fullName: null,
    email: null,
    disciplines: [...(discByCandidate.get(p.id as string) ?? [])],
  }))

  // ── SUBSET COMPOSE — applied AFTER partner scope; can only NARROW ──
  if (opts?.candidateUserIds) {
    const want = new Set(opts.candidateUserIds)
    roster = roster.filter((r) => want.has(r.userId))
  }

  const inScopeUserIds = roster.map((r) => r.userId)
  if (!inScopeUserIds.length) return []

  // ── STEP 3 — display names from profiles.full_name ──
  const { data: people, error: peopleErr } = await supabaseServer
    .from('profiles')
    .select('id, full_name')
    .in('id', inScopeUserIds)
  if (peopleErr) throw peopleErr
  const nameByUserId = new Map<string, string | null>(
    (people ?? []).map((pp) => [pp.id as string, (pp.full_name as string | null) ?? null])
  )

  // ── STEP 4 — emails from auth.users (service-role admin; in-scope ids only) ──
  // N× getUserById, parallelized. TODO: batch via listUsers paging if N grows large.
  const emailEntries = await Promise.all(
    inScopeUserIds.map(async (id) => {
      const { data, error } = await supabaseServer.auth.admin.getUserById(id)
      return [id, error ? null : (data.user?.email ?? null)] as const
    })
  )
  const emailByUserId = new Map<string, string | null>(emailEntries)

  for (const r of roster) {
    r.fullName = nameByUserId.get(r.userId) ?? null
    r.email = emailByUserId.get(r.userId) ?? null
  }

  return roster
}

/**
 * Roster of candidates this partner has entitled (deduped, disciplines aggregated).
 * No session/evaluation data. Scoped strictly to `partnerId`.
 */
export async function getPartnerCandidates(
  partnerId: string
): Promise<PartnerCandidate[]> {
  return resolvePartnerRoster(partnerId)
}

/**
 * Roster + LEFT-JOINed simulation progress. Entitled-but-inactive candidates
 * still appear (with `simulations: []`). Sessions/evals are filtered, PER CANDIDATE,
 * to the disciplines THIS partner entitled for that candidate — activity another
 * partner (or a self-purchase) funded in a non-entitled discipline is excluded.
 *
 * `opts.candidateUserIds` narrows within the partner scope (see resolvePartnerRoster).
 */
export async function getPartnerCandidateProgress(
  partnerId: string,
  opts?: { candidateUserIds?: string[] }
): Promise<PartnerCandidateWithProgress[]> {
  const roster = await resolvePartnerRoster(partnerId, opts)
  if (!roster.length) return []

  const inScopeUserIds = roster.map((r) => r.userId)
  const disciplinesByUserId = new Map<string, Set<string>>(
    roster.map((r) => [r.userId, new Set(r.disciplines)])
  )

  // ── STEP 5 — sessions for in-scope users only (discipline filtered in JS, per-candidate) ──
  const { data: sessions, error: sessErr } = await supabaseServer
    .from('simulation_sessions')
    .select('id, user_id, simulation_slug, discipline, status, started_at, submitted_at')
    .in('user_id', inScopeUserIds)
  if (sessErr) throw sessErr

  // Keep only sessions whose discipline is in that candidate's entitled-by-this-partner set.
  const keptSessions = (sessions ?? []).filter((s) => {
    const allowed = disciplinesByUserId.get(s.user_id as string)
    return !!allowed && !!s.discipline && allowed.has(s.discipline as string)
  })

  // ── STEP 6 — evals for in-scope users; attached to surviving sessions by session id ──
  // (an eval whose session was filtered out as non-entitled is dropped with it)
  const { data: evals, error: evalErr } = await supabaseServer
    .from('evaluation_results')
    .select('user_id, session_id, simulation_slug, verdict_band, overall_score, evaluated_at')
    .in('user_id', inScopeUserIds)
  if (evalErr) throw evalErr

  // session id -> latest eval (defensive: keep the most recently evaluated on collision)
  const evalBySession = new Map<string, (typeof evals)[number]>()
  for (const ev of evals ?? []) {
    if (!ev.session_id) continue
    const existing = evalBySession.get(ev.session_id as string)
    if (!existing || String(ev.evaluated_at) > String(existing.evaluated_at)) {
      evalBySession.set(ev.session_id as string, ev)
    }
  }

  // Build simulations[] per candidate from their kept sessions (the LEFT-JOIN spine).
  const sessionsByUser = new Map<string, typeof keptSessions>()
  for (const s of keptSessions) {
    const arr = sessionsByUser.get(s.user_id as string) ?? []
    arr.push(s)
    sessionsByUser.set(s.user_id as string, arr)
  }

  return roster.map((r) => {
    const userSessions = sessionsByUser.get(r.userId) ?? []
    const simulations: CandidateSimulationProgress[] = userSessions.map((s) => {
      const ev = evalBySession.get(s.id as string)
      return {
        simulationSlug: s.simulation_slug as string,
        discipline: (s.discipline as string | null) ?? null,
        status: (s.status as string | null) ?? null,
        startedAt: (s.started_at as string | null) ?? null,
        submittedAt: (s.submitted_at as string | null) ?? null,
        verdictBand: (ev?.verdict_band as string | null) ?? null,
        overallScore: (ev?.overall_score as number | null) ?? null,
        evaluatedAt: (ev?.evaluated_at as string | null) ?? null,
      }
    })
    return { ...r, simulations }
  })
}

import { supabaseServer } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Candidate DETAIL — the partner admin's internal drill-down (Spec 05.9).
//
// SENSITIVE: returns full evaluation detail AND the candidate's raw task
// submissions (response_text, rationale, files, links) for dispute resolution.
//
// Isolation works exactly like the roster primitive: the FIRST query is an
// entitlement gate scoped to the authenticated partnerId, with the URL-supplied
// candidateId only as a filter WITHIN that scope. If the candidate is not
// entitled by THIS partner (active), the function returns null BEFORE any
// sensitive read happens, and the caller renders notFound() (404, no existence
// leak). Service-role (supabaseServer) bypasses RLS, so this partnerId scope is
// the sole tenant boundary — caller must pass the authenticated partner's id.
//
// Files live in the PRIVATE `simulation-submissions` bucket and file_urls stores
// storage PATHS, not URLs — so we mint short-lived signed URLs server-side.
// ─────────────────────────────────────────────────────────────────────────────

const SUBMISSIONS_BUCKET = 'simulation-submissions'
const SIGNED_URL_TTL = 3600 // 1 hour

export type CandidateResponse = {
  taskNumber: number
  responseText: string | null
  rationaleText: string | null
  files: { path: string; signedUrl: string | null }[] // signedUrl null if signing failed
  linkUrls: string[]
}

export type CandidateSimulationDetail = {
  simulationSlug: string
  discipline: string | null
  status: string | null
  startedAt: string | null
  submittedAt: string | null
  evaluation: {
    verdictBand: string | null
    overallScore: number | null
    taskScores: unknown
    criteriaScores: unknown
    feedbackText: string | null
  } | null
  responses: CandidateResponse[]
}

export type PartnerCandidateDetail = {
  candidateId: string
  userId: string
  slug: string
  fullName: string | null
  email: string | null
  country: string | null
  disciplines: string[]
  simulations: CandidateSimulationDetail[]
}

export async function getPartnerCandidateDetail(
  partnerId: string,
  candidateId: string,
): Promise<PartnerCandidateDetail | null> {
  // ── GATE: candidate must be entitled BY THIS PARTNER, active. ──
  // partnerId is the authenticated partner (never from the URL); candidateId is
  // the URL id, used ONLY as a filter within the partner's scope. A bad/foreign
  // id yields zero rows (or a cast error -> null data) -> return null -> 404.
  const { data: ents } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id, discipline')
    .eq('granted_by_partner', partnerId)
    .eq('candidate_id', candidateId)
    .is('revoked_at', null)
  if (!ents?.length) return null

  const entitled = new Set((ents.map((e) => e.discipline).filter(Boolean)) as string[])

  // ── Resolve the validated candidate's profile -> user_id, slug. ──
  const { data: prof } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id, slug, country')
    .eq('id', candidateId)
    .maybeSingle()
  if (!prof) return null
  const userId = prof.user_id as string

  // Display name (profiles) + email (auth.users via service-role admin API).
  const { data: person } = await supabaseServer.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  const { data: au } = await supabaseServer.auth.admin.getUserById(userId)

  const base = {
    candidateId,
    userId,
    slug: prof.slug as string,
    fullName: (person?.full_name as string | null) ?? null,
    email: au?.user?.email ?? null,
    country: (prof.country as string | null) ?? null,
    disciplines: [...entitled],
  }

  // ── Sessions, bounded to the disciplines THIS partner entitled (per-candidate). ──
  const { data: sessRows } = await supabaseServer
    .from('simulation_sessions')
    .select('id, simulation_slug, discipline, status, started_at, submitted_at')
    .eq('user_id', userId)
  const sessions = (sessRows ?? []).filter((s) => s.discipline && entitled.has(s.discipline as string))
  if (!sessions.length) return { ...base, simulations: [] }

  const sessionIds = sessions.map((s) => s.id as string)

  // Full evaluations (NO raw_evaluation) + raw responses, scoped to those sessions.
  const { data: evals } = await supabaseServer
    .from('evaluation_results')
    .select('session_id, verdict_band, overall_score, task_scores, criteria_scores, feedback_text')
    .in('session_id', sessionIds)
  const { data: resps } = await supabaseServer
    .from('simulation_responses')
    .select('session_id, task_number, response_text, rationale_text, file_urls, link_urls')
    .in('session_id', sessionIds)

  // Batch-sign every file path (private bucket; service-role can sign for any owner).
  const paths = [...new Set((resps ?? []).flatMap((r) => (r.file_urls as string[] | null) ?? []))]
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data: signedRows } = await supabaseServer.storage.from(SUBMISSIONS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
    for (const s of signedRows ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const evalBySession = new Map((evals ?? []).map((e) => [e.session_id as string, e]))
  const respBySession = new Map<string, NonNullable<typeof resps>>()
  for (const r of resps ?? []) {
    const arr = respBySession.get(r.session_id as string) ?? []
    arr.push(r)
    respBySession.set(r.session_id as string, arr)
  }

  const simulations: CandidateSimulationDetail[] = sessions.map((s) => {
    const ev = evalBySession.get(s.id as string)
    const rs = (respBySession.get(s.id as string) ?? []).slice().sort((a, b) => (a.task_number as number) - (b.task_number as number))
    return {
      simulationSlug: s.simulation_slug as string,
      discipline: (s.discipline as string | null) ?? null,
      status: (s.status as string | null) ?? null,
      startedAt: (s.started_at as string | null) ?? null,
      submittedAt: (s.submitted_at as string | null) ?? null,
      evaluation: ev
        ? {
            verdictBand: (ev.verdict_band as string | null) ?? null,
            overallScore: (ev.overall_score as number | null) ?? null,
            taskScores: ev.task_scores,
            criteriaScores: ev.criteria_scores,
            feedbackText: (ev.feedback_text as string | null) ?? null,
          }
        : null,
      responses: rs.map((r) => ({
        taskNumber: r.task_number as number,
        responseText: (r.response_text as string | null) ?? null,
        rationaleText: (r.rationale_text as string | null) ?? null,
        files: ((r.file_urls as string[] | null) ?? []).map((p) => ({ path: p, signedUrl: signed.get(p) ?? null })),
        linkUrls: (r.link_urls as string[] | null) ?? [],
      })),
    }
  })

  return { ...base, simulations }
}

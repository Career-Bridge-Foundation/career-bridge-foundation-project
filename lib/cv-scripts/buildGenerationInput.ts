import { supabaseServer } from '@/lib/supabase/server';
import { achievingResult } from '@/lib/portfolio/highestVerdictBand';
import { getCanonicalPortfolioUrl } from '@/lib/portfolio/canonicalUrl';

// Spec 14 decision 7, mirrored here (defense in depth — the caller should
// already only invoke generation for assessed sessions, since practice runs
// never reach evaluation_results at all).
export class NotAssessedError extends Error {
  constructor(slug: string) {
    super(`simulation ${slug} is a practice simulation — generation must not run`);
    this.name = 'NotAssessedError';
  }
}

// Spec 17 §5: scenario_context is authored deliberately per simulation and
// must never be derived from `company`/`title` (that would leak the
// fictional employer). Until a simulation has it authored, generation for
// that simulation fails closed — no row, no error surfaced to the candidate.
export class ScenarioContextMissingError extends Error {
  constructor(slug: string) {
    super(`simulation ${slug} has no scenario_context authored yet — generation skipped`);
    this.name = 'ScenarioContextMissingError';
  }
}

type DimensionScore = { name: string; score: number; descriptor: string };

export type GenerationInput = {
  candidateUserId: string;
  discipline: string;
  verdictBand: string;
  dimensionScores: DimensionScore[];
  scenarioContext: string;
  completedCount: number;
  bandDistribution: Record<string, number>;
  portfolioUrl: string;
  simulationSlug: string;
  simulationTitle: string;
  sourceEvaluationId: string;
};

const QUALIFYING_BANDS = new Set(['Distinction', 'Merit', 'Pass']);

/**
 * Assembles the Spec 17 §5 generation payload from stored evaluation data.
 * Real columns (verified live 2026-09-03): evaluation_results.criteria_scores
 * (no dimension_scores column exists), simulation_sessions.discipline,
 * simulations.scenario_context (new, Spec 17).
 */
export async function buildGenerationInput(sessionId: string): Promise<GenerationInput> {
  const { data: evalRow, error: evalError } = await supabaseServer
    .from('evaluation_results')
    .select('id, user_id, simulation_slug, verdict_band, criteria_scores')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (evalError || !evalRow) {
    throw new Error(`No evaluation_results row for session ${sessionId}`);
  }

  const [{ data: session }, { data: simulation }, { data: profile }] = await Promise.all([
    supabaseServer
      .from('simulation_sessions')
      .select('discipline')
      .eq('id', sessionId)
      .maybeSingle(),
    supabaseServer
      .from('simulations')
      .select('slug, title, discipline, simulation_type, scenario_context')
      .eq('slug', evalRow.simulation_slug)
      .maybeSingle(),
    supabaseServer
      .from('portfolio_profiles')
      .select('slug')
      .eq('user_id', evalRow.user_id)
      .maybeSingle(),
  ]);

  if (!simulation) {
    throw new Error(`No simulation row for slug ${evalRow.simulation_slug}`);
  }
  if (simulation.simulation_type === 'practice') {
    throw new NotAssessedError(simulation.slug);
  }
  if (!simulation.scenario_context) {
    throw new ScenarioContextMissingError(simulation.slug);
  }
  if (!profile?.slug) {
    throw new Error(`No portfolio_profiles row for user ${evalRow.user_id} — cannot build portfolio_url`);
  }

  const discipline = session?.discipline ?? simulation.discipline ?? simulation.slug;

  // Spec 17 locked answer #4: criteria_scores is per-task-per-criterion (a
  // name can repeat across tasks) — average the score per criterion name.
  const rawCriteria = (evalRow.criteria_scores ?? []) as Array<{
    name?: string;
    score?: number;
    level?: string;
  }>;
  const byName = new Map<string, { total: number; count: number; level?: string }>();
  for (const c of rawCriteria) {
    if (!c?.name) continue;
    const bucket = byName.get(c.name) ?? { total: 0, count: 0, level: c.level };
    bucket.total += c.score ?? 0;
    bucket.count += 1;
    byName.set(c.name, bucket);
  }
  const dimensionScores: DimensionScore[] = Array.from(byName.entries()).map(([name, b]) => ({
    name,
    score: Math.round((b.total / b.count) * 10) / 10,
    descriptor: b.level ?? '',
  }));

  // completed_count / band_distribution: one qualifying (>= Pass) result per
  // simulation the candidate has attempted in this discipline, best band wins
  // on retake — mirrors loadEditableSimulations() in app/portfolio/edit/page.tsx.
  const [{ data: disciplineSessions }, { data: disciplineEvals }] = await Promise.all([
    supabaseServer
      .from('simulation_sessions')
      .select('simulation_slug')
      .eq('user_id', evalRow.user_id)
      .eq('discipline', discipline)
      .eq('status', 'evaluated'),
    supabaseServer
      .from('evaluation_results')
      .select('simulation_slug, verdict_band, evaluated_at')
      .eq('user_id', evalRow.user_id),
  ]);

  const disciplineSlugSet = new Set((disciplineSessions ?? []).map((s) => s.simulation_slug));
  const evalsBySlug = new Map<string, { verdict_band: string; evaluated_at: string }[]>();
  for (const e of disciplineEvals ?? []) {
    if (!disciplineSlugSet.has(e.simulation_slug)) continue;
    const bucket = evalsBySlug.get(e.simulation_slug) ?? [];
    bucket.push({ verdict_band: e.verdict_band, evaluated_at: e.evaluated_at });
    evalsBySlug.set(e.simulation_slug, bucket);
  }

  const bandDistribution: Record<string, number> = {};
  let completedCount = 0;
  for (const results of evalsBySlug.values()) {
    const best = achievingResult(results);
    if (!best || !QUALIFYING_BANDS.has(best.verdict_band)) continue;
    completedCount += 1;
    bandDistribution[best.verdict_band] = (bandDistribution[best.verdict_band] ?? 0) + 1;
  }

  return {
    candidateUserId: evalRow.user_id,
    discipline,
    verdictBand: evalRow.verdict_band,
    dimensionScores,
    scenarioContext: simulation.scenario_context,
    completedCount,
    bandDistribution,
    portfolioUrl: getCanonicalPortfolioUrl(profile.slug),
    simulationSlug: simulation.slug,
    simulationTitle: simulation.title ?? simulation.slug,
    sourceEvaluationId: evalRow.id,
  };
}

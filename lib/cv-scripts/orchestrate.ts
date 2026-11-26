import { supabaseServer } from '@/lib/supabase/server';
import { verdictRank } from '@/lib/verdict-bands';
import { buildGenerationInput, NotAssessedError, ScenarioContextMissingError, type GenerationInput } from './buildGenerationInput';
import { generateSimulationBullet, generateDisciplineSummary } from './generate';
import { runValidationGuard } from './validate';
import { persistCvScript, findCurrentBySourceEvaluation, getCurrentSimulationScript } from './persist';
import type { CvScriptFormats, CvScriptScope } from './types';

const QUALIFYING_MIN_RANK = verdictRank('Pass');
const DISCIPLINE_SUMMARY_THRESHOLD = 2; // Spec 17 locked answer #3

export type RunResult =
  | { scope: CvScriptScope; status: 'generated' }
  | { scope: CvScriptScope | 'input'; status: 'skipped'; reason: string }
  | { scope: CvScriptScope; status: 'failed'; reason: string };

/**
 * Entry point for Spec 17 generation. Called best-effort, in-process, from
 * POST /api/certifier/issue right after credential_issuances is persisted —
 * never awaited in a way that could fail the issuance response (the caller
 * wraps this in try/catch). Also reused by the admin regenerate route and
 * the internal HTTP route, so this is the one place the pipeline is defined.
 */
export async function runCvScriptGeneration(
  sessionId: string,
  options: { force?: boolean } = {}
): Promise<RunResult[]> {
  const { force = false } = options;
  let input: GenerationInput;
  try {
    input = await buildGenerationInput(sessionId);
  } catch (err) {
    if (err instanceof ScenarioContextMissingError || err instanceof NotAssessedError) {
      return [{ scope: 'input', status: 'skipped', reason: err.message }];
    }
    throw err;
  }

  if (verdictRank(input.verdictBand) < QUALIFYING_MIN_RANK) {
    return [{ scope: 'input', status: 'skipped', reason: `verdict_band "${input.verdictBand}" does not qualify (< Pass)` }];
  }

  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('company')
    .eq('slug', input.simulationSlug)
    .maybeSingle();
  const companyName = sim?.company ?? null;

  const results: RunResult[] = [];

  // ── Simulation-scope bullet ──
  // Idempotent on source_evaluation_id (skip an exact duplicate call), and
  // regenerated only on band improvement (Spec 17 §4 / §9) — never on a
  // retake that ties or lowers the band.
  const duplicate = force ? null : await findCurrentBySourceEvaluation(input.sourceEvaluationId);
  if (duplicate) {
    results.push({ scope: 'simulation', status: 'skipped', reason: 'already generated for this evaluation' });
  } else {
    const currentSim = await getCurrentSimulationScript(input.candidateUserId, input.simulationSlug);
    const improved = force || !currentSim || verdictRank(input.verdictBand) > verdictRank(currentSim.verdict_band ?? '');
    if (!improved) {
      results.push({ scope: 'simulation', status: 'skipped', reason: 'retake did not improve band — prior row stays current' });
    } else {
      results.push(
        await generateWithRetry('simulation', () => generateSimulationBullet(input), input, companyName)
      );
    }
  }

  // ── Discipline-summary scope ──
  // Spec 17 §4: appears on the 2nd assessed pass, regenerates on every
  // subsequent pass in that discipline.
  if (input.completedCount >= DISCIPLINE_SUMMARY_THRESHOLD) {
    results.push(
      await generateWithRetry('discipline_summary', () => generateDisciplineSummary(input), input, companyName)
    );
  }

  return results;
}

async function generateWithRetry(
  scope: CvScriptScope,
  generateFn: () => Promise<Partial<CvScriptFormats>>,
  input: GenerationInput,
  companyName: string | null
): Promise<RunResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const formats = await generateFn();
      const guard = await runValidationGuard(formats, input, companyName);
      if (guard.ok) {
        await persistCvScript(scope, input, formats);
        return { scope, status: 'generated' };
      }
      console.warn(`[cv-scripts] validation guard rejected attempt ${attempt} (${scope}):`, guard.reasons);
    } catch (err) {
      console.error(`[cv-scripts] generation attempt ${attempt} failed (${scope}):`, err);
    }
  }

  // Spec 17 §9: generation fails twice → no row written, never surface a
  // half-generated bullet, logged for manual regeneration via the admin route.
  console.error(
    `[cv-scripts] generation failed twice for scope=${scope}, candidate=${input.candidateUserId}, discipline=${input.discipline} — flagged for manual regeneration`
  );
  return { scope, status: 'failed', reason: 'generation or validation failed twice' };
}

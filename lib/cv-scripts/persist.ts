import { supabaseServer } from '@/lib/supabase/server';
import type { GenerationInput } from './buildGenerationInput';
import type { CvScriptFormats, CvScriptScope } from './types';

const GENERATOR_VERSION = 'v1';

/** Idempotency guard: has this exact evaluation already produced a current row? */
export async function findCurrentBySourceEvaluation(sourceEvaluationId: string) {
  const { data } = await supabaseServer
    .from('candidate_cv_scripts')
    .select('id')
    .eq('source_evaluation_id', sourceEvaluationId)
    .eq('scope', 'simulation')
    .eq('is_current', true)
    .maybeSingle();
  return data;
}

/** Current simulation-scope row for a slug, used to gate "regenerate on band improvement only". */
export async function getCurrentSimulationScript(candidateUserId: string, simulationSlug: string) {
  const { data } = await supabaseServer
    .from('candidate_cv_scripts')
    .select('id, verdict_band')
    .eq('candidate_user_id', candidateUserId)
    .eq('scope', 'simulation')
    .eq('simulation_slug', simulationSlug)
    .eq('is_current', true)
    .maybeSingle();
  return data;
}

// NOTE: this table's write path is documented as non-atomic at the top of
// supabase/migrations/20260903_001_create_candidate_cv_scripts.sql. The
// supersede-then-insert below is two separate calls, not one transaction.
export async function persistCvScript(
  scope: CvScriptScope,
  input: GenerationInput,
  formats: Partial<CvScriptFormats>
): Promise<void> {
  const supersedeBase = supabaseServer
    .from('candidate_cv_scripts')
    .update({ is_current: false })
    .eq('candidate_user_id', input.candidateUserId)
    .eq('scope', scope)
    .eq('discipline', input.discipline)
    .eq('is_current', true);

  await (scope === 'simulation'
    ? supersedeBase.eq('simulation_slug', input.simulationSlug)
    : supersedeBase.is('simulation_slug', null));

  await supabaseServer.from('candidate_cv_scripts').insert({
    candidate_user_id: input.candidateUserId,
    scope,
    simulation_slug: scope === 'simulation' ? input.simulationSlug : null,
    discipline: input.discipline,
    verdict_band: input.verdictBand,
    completed_count: input.completedCount,
    source_evaluation_id: input.sourceEvaluationId,
    formats,
    generator_version: GENERATOR_VERSION,
    is_current: true,
  });
}

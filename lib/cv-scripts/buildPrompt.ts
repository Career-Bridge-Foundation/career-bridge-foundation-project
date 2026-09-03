import type { VerdictBand } from '@/lib/verdict-bands';
import type { GenerationInput } from './buildGenerationInput';

// Fixed vocabulary per band (Spec 17 §6: "band never overstated — fixed
// vocabulary map per band"). Enforced both here (prompt guidance) and in
// validate.ts (reverse-lookup rejection of higher-tier adjectives).
export const BAND_VOCABULARY: Record<VerdictBand, string[]> = {
  Distinction: ['exceptional', 'outstanding', 'exemplary', 'masterful'],
  Merit: ['strong', 'accomplished', 'highly competent'],
  Pass: ['competent', 'sound', 'capable'],
  Borderline: [],
  'Did Not Pass': [],
};

function sharedRules(): string {
  return `
Rules (all mandatory):
- British English spelling and phrasing throughout.
- Third-person / neutral register. No first-person pronouns ("I", "my").
- Never invent a percentage, currency figure, timing, cost saving, or headcount. Only reference numbers explicitly given to you below.
- Never name the client/employer from the simulation brief. Refer to the setting only via the scenario description given below.
- Never mention any partner organisation by name.
- Match wording to the achieved band exactly — never use language from a higher band. Distinction-tier: ${BAND_VOCABULARY.Distinction.join(', ')}. Merit-tier: ${BAND_VOCABULARY.Merit.join(', ')}. Pass-tier: ${BAND_VOCABULARY.Pass.join(', ')}.
- State volume literally — a count of 4 is "four", never "extensive" or "numerous".
- Return ONLY the JSON described below. No markdown fences, no commentary before or after it.
`.trim();
}

export function buildSimulationBulletPrompt(input: GenerationInput): { system: string; user: string } {
  const system = `You write single CV bullet points for a candidate portfolio, based strictly on verified workplace simulation assessment data.\n\n${sharedRules()}`;

  const user = `Write one CV bullet point (max 220 characters) describing this single completed, assessed simulation.

Discipline: ${input.discipline}
Simulation title: ${input.simulationTitle}
Scenario setting (use only this, never a client/employer name): ${input.scenarioContext}
Achieved band: ${input.verdictBand}
Assessed dimension scores (JSON, for context only — do not quote raw scores): ${JSON.stringify(input.dimensionScores)}

Return ONLY this JSON:
{ "cv_bullet": "..." }`;

  return { system, user };
}

export function buildDisciplineSummaryPrompt(input: GenerationInput): { system: string; user: string } {
  const system = `You write CV discipline-summary paragraphs and LinkedIn Projects/About copy for a candidate portfolio, based strictly on verified workplace simulation assessment data.\n\n${sharedRules()}`;

  const user = `Write copy summarising a candidate's cumulative performance across ${input.completedCount} assessed simulations in this discipline.

Discipline: ${input.discipline}
Completed count (state this literally, e.g. "${input.completedCount}"): ${input.completedCount}
Band distribution (JSON): ${JSON.stringify(input.bandDistribution)}
A representative scenario setting (use only this, never a client/employer name): ${input.scenarioContext}
Portfolio verification URL (must appear verbatim at the end of cv_summary, and as the linkedin_project url): ${input.portfolioUrl}

Produce:
- cv_summary: a 2-3 sentence paragraph for a "Verified Simulations" CV section, ending with the portfolio URL.
- linkedin_project: a LinkedIn "Projects" entry — title (max 100 characters), description (max 2000 characters, no URL inside the description text itself), url (the portfolio URL given above, verbatim).
- linkedin_about: 1-2 sentences suitable for pasting into a LinkedIn About section.

Return ONLY this JSON:
{
  "cv_summary": "...",
  "linkedin_project": { "title": "...", "description": "...", "url": "${input.portfolioUrl}" },
  "linkedin_about": "..."
}`;

  return { system, user };
}

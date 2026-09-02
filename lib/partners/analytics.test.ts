/**
 * Hand-rolled tests for computePartnerAnalytics (the v1 metric definitions).
 * Run with: npx tsx lib/partners/analytics.test.ts
 * Exits 1 if any test fails, 0 if all pass.
 */

import { computePartnerAnalytics } from './analytics';
import type { PartnerCandidateWithProgress, CandidateSimulationProgress } from './candidateProgress';

let passed = 0;
let failed = 0;

function assert(testName: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`✓ ${testName}`);
  } else {
    failed++;
    console.error(
      `✗ ${testName}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

function sim(discipline: string, verdictBand: string | null): CandidateSimulationProgress {
  return {
    simulationSlug: `${discipline}-sim`,
    discipline,
    status: verdictBand ? 'evaluated' : 'in_progress',
    startedAt: '2026-06-01T00:00:00Z',
    submittedAt: verdictBand ? '2026-06-02T00:00:00Z' : null,
    verdictBand,
    overallScore: verdictBand ? 40 : null,
    evaluatedAt: verdictBand ? '2026-06-03T00:00:00Z' : null,
  };
}
function cand(id: string, disciplines: string[], sims: CandidateSimulationProgress[]): PartnerCandidateWithProgress {
  return { candidateId: id, userId: `u-${id}`, slug: id, fullName: id, email: null, disciplines, country: null, countryLockedAt: null, simulations: sims };
}

// Fixture: 4 candidates with known progress.
const FIX: PartnerCandidateWithProgress[] = [
  cand('c1', ['cyber-security'], []),                                              // not started
  cand('c2', ['cyber-security'], [sim('cyber-security', null)]),                   // started, not evaluated
  cand('c3', ['cyber-security', 'product-management'], [sim('cyber-security', 'Distinction'), sim('product-management', 'Merit')]), // best Distinction
  cand('c4', ['product-management'], [sim('product-management', 'Pass')]),         // best Pass
];

const a = computePartnerAnalytics(FIX);

console.log('\n── funnel ──');
assert('funnel counts (cumulative)', a.funnel, { provisioned: 4, started: 3, evaluated: 2, notStarted: 1 });

console.log('\n── verdict distribution (per-candidate best) ──');
assert('distribution ordered + counted', a.verdictDistribution, [
  { band: 'Distinction', count: 1 },
  { band: 'Merit', count: 0 },
  { band: 'Pass', count: 1 },
  { band: 'Borderline', count: 0 },
  { band: 'Did Not Pass', count: 0 },
]);
assert('candidatesWithVerdict == evaluated', a.candidatesWithVerdict, 2);

console.log('\n── per-discipline ──');
assert('byDiscipline counts', a.byDiscipline, [
  { discipline: 'cyber-security', candidates: 3, started: 2, evaluated: 1 },
  { discipline: 'product-management', candidates: 2, started: 2, evaluated: 2 },
]);

console.log('\n── edge: empty roster ──');
assert('empty → zeros', computePartnerAnalytics([]).funnel, { provisioned: 0, started: 0, evaluated: 0, notStarted: 0 });

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);

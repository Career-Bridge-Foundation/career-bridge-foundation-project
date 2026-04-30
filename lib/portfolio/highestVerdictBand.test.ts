/**
 * Hand-rolled tests for highestVerdictBand and achievingResult.
 * Run with: npx tsx lib/portfolio/highestVerdictBand.test.ts
 *
 * Exits 1 if any test fails, 0 if all pass.
 */

import { highestVerdictBand, achievingResult } from './highestVerdictBand';

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

// ── highestVerdictBand ────────────────────────────────────────────────

console.log('\n── highestVerdictBand ──');

assert('empty array returns null',
  highestVerdictBand([]), null);

assert('single Distinction',
  highestVerdictBand(['Distinction']), 'Distinction');

assert('single Did Not Pass',
  highestVerdictBand(['Did Not Pass']), 'Did Not Pass');

assert('Distinction beats Merit',
  highestVerdictBand(['Merit', 'Distinction']), 'Distinction');

assert('Merit beats Pass',
  highestVerdictBand(['Pass', 'Merit']), 'Merit');

assert('Pass beats Borderline',
  highestVerdictBand(['Borderline', 'Pass']), 'Pass');

assert('Borderline beats Did Not Pass',
  highestVerdictBand(['Did Not Pass', 'Borderline']), 'Borderline');

assert('all five bands returns Distinction',
  highestVerdictBand(['Did Not Pass', 'Borderline', 'Pass', 'Merit', 'Distinction']),
  'Distinction');

assert('tie: same band twice returns that band',
  highestVerdictBand(['Merit', 'Merit']), 'Merit');

assert('unknown band loses to Did Not Pass',
  highestVerdictBand(['unknown-band', 'Did Not Pass']), 'Did Not Pass');

assert('all unknown bands: returns first element (consistent)',
  highestVerdictBand(['foo', 'bar']), 'foo');

// ── achievingResult ───────────────────────────────────────────────────

console.log('\n── achievingResult ──');

type Row = { verdict_band: string; evaluated_at: string; label: string };

assert('empty array returns null',
  achievingResult<Row>([]), null);

assert('single row is returned',
  achievingResult<Row>([
    { verdict_band: 'Merit', evaluated_at: '2026-01-01T00:00:00Z', label: 'A' },
  ])?.label,
  'A');

assert('highest band wins regardless of date order',
  achievingResult<Row>([
    { verdict_band: 'Pass',        evaluated_at: '2026-03-01T00:00:00Z', label: 'later-lower' },
    { verdict_band: 'Distinction', evaluated_at: '2026-01-01T00:00:00Z', label: 'earlier-higher' },
  ])?.label,
  'earlier-higher');

assert('tie on band: more recent evaluated_at wins',
  achievingResult<Row>([
    { verdict_band: 'Merit', evaluated_at: '2026-01-01T10:00:00Z', label: 'older' },
    { verdict_band: 'Merit', evaluated_at: '2026-01-02T10:00:00Z', label: 'newer' },
  ])?.label,
  'newer');

assert('all five bands: Distinction row returned',
  achievingResult<Row>([
    { verdict_band: 'Did Not Pass', evaluated_at: '2026-01-01T00:00:00Z', label: 'E' },
    { verdict_band: 'Borderline',   evaluated_at: '2026-01-02T00:00:00Z', label: 'D' },
    { verdict_band: 'Pass',         evaluated_at: '2026-01-03T00:00:00Z', label: 'C' },
    { verdict_band: 'Merit',        evaluated_at: '2026-01-04T00:00:00Z', label: 'B' },
    { verdict_band: 'Distinction',  evaluated_at: '2026-01-05T00:00:00Z', label: 'A' },
  ])?.label,
  'A');

// ── Summary ───────────────────────────────────────────────────────────

console.log(`\n${passed}/${passed + failed} passed`);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

process.exit(0);

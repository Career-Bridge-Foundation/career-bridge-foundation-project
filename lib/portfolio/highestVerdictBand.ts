import { verdictRank } from '@/lib/verdict-bands';

/**
 * Returns the highest verdict band string from an array.
 * Unknown band strings are treated as below 'Did Not Pass'.
 * Returns null for an empty array.
 */
export function highestVerdictBand(bands: string[]): string | null {
  if (bands.length === 0) return null;
  return bands.reduce((best, current) =>
    verdictRank(current) > verdictRank(best) ? current : best
  );
}

/**
 * From an array of evaluation result rows, returns the row that achieved
 * the highest verdict band. On a tie, the more recent evaluated_at wins.
 * Returns null for an empty array.
 */
export function achievingResult<T extends { verdict_band: string; evaluated_at: string }>(
  results: T[]
): T | null {
  if (results.length === 0) return null;
  return results.reduce((best, current) => {
    const bestOrder = verdictRank(best.verdict_band);
    const currentOrder = verdictRank(current.verdict_band);
    if (currentOrder > bestOrder) return current;
    if (currentOrder === bestOrder) {
      return current.evaluated_at > best.evaluated_at ? current : best;
    }
    return best;
  });
}

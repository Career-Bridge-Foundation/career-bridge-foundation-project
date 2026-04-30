const BAND_ORDER: Record<string, number> = {
  'Distinction':  4,
  'Merit':        3,
  'Pass':         2,
  'Borderline':   1,
  'Did Not Pass': 0,
};

/**
 * Returns the highest verdict band string from an array.
 * Unknown band strings are treated as below 'Did Not Pass'.
 * Returns null for an empty array.
 */
export function highestVerdictBand(bands: string[]): string | null {
  if (bands.length === 0) return null;
  return bands.reduce((best, current) =>
    (BAND_ORDER[current] ?? -1) > (BAND_ORDER[best] ?? -1) ? current : best
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
    const bestOrder = BAND_ORDER[best.verdict_band] ?? -1;
    const currentOrder = BAND_ORDER[current.verdict_band] ?? -1;
    if (currentOrder > bestOrder) return current;
    if (currentOrder === bestOrder) {
      return current.evaluated_at > best.evaluated_at ? current : best;
    }
    return best;
  });
}

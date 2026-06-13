// Single source of truth for verdict bands (Vocabulary A): canonical order,
// derived rank, the VerdictBand type, and the partner-console style map.
// Order + rank + type all derive from VERDICT_BANDS, so they cannot drift.
//
// Scope: the evaluation pipeline uses a DIFFERENT label set ("Pass with Merit"
// — Vocabulary B; see issue #49). Portfolio/OG hex chip styles and the certifier
// QUALIFYING_BANDS set are intentionally separate and NOT defined here.

export const VERDICT_BANDS = ['Distinction', 'Merit', 'Pass', 'Borderline', 'Did Not Pass'] as const
export type VerdictBand = (typeof VERDICT_BANDS)[number]

// Rank: higher = better, derived from list position. Distinction=4 … Did Not Pass=0.
// Unknown/empty → -1, preserving "unknown loses to Did Not Pass".
const RANK: Record<string, number> = Object.fromEntries(
  VERDICT_BANDS.map((b, i) => [b, VERDICT_BANDS.length - 1 - i]),
)
export function verdictRank(band: string): number {
  return RANK[band] ?? -1
}

// Partner-console verdict chip styles (Tailwind). Typed Record<VerdictBand> so
// every band must have a style. Portfolio/OG chips keep their own hex maps.
const PARTNER_VERDICT_STYLE: Record<VerdictBand, string> = {
  Distinction: 'bg-teal/10 text-teal border-teal/30',
  Merit: 'bg-blue-50 text-blue-700 border-blue-200',
  Pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Borderline: 'bg-amber-50 text-amber-700 border-amber-200',
  'Did Not Pass': 'bg-red-50 text-red-700 border-red-200',
}
const PARTNER_VERDICT_STYLE_FALLBACK = 'border-slate-200 bg-slate-50 text-slate-600'

/** Partner-console Tailwind classes for a verdict band; neutral fallback for unknown. */
export function partnerVerdictStyle(band: string): string {
  return PARTNER_VERDICT_STYLE[band as VerdictBand] ?? PARTNER_VERDICT_STYLE_FALLBACK
}

import { highestVerdictBand } from '@/lib/portfolio/highestVerdictBand'
import { VERDICT_BANDS, type VerdictBand } from '@/lib/verdict-bands'
import type { PartnerCandidateWithProgress } from '@/lib/partners/candidateProgress'

// ─────────────────────────────────────────────────────────────────────
// V1 METRIC DEFINITIONS — the single place to reconcile with Spec 06.
// These are DELIBERATE v1 choices (Spec 06 not yet available), NOT silent
// assumptions. When Spec 06 lands, adjust HERE.
//
//   provisioned = every candidate the partner entitled (roster size).
//   started     = candidate has begun >=1 simulation (>=1 session exists).
//   evaluated   = candidate has >=1 simulation with a verdict band.
//   notStarted  = provisioned - started.
//   FUNNEL IS CUMULATIVE: evaluated ⊆ started ⊆ provisioned.
//   verdict distribution = each candidate counted ONCE by their BEST verdict
//     (highestVerdictBand across their evaluated sims). Spec 06 may instead
//     want per-simulation counts — change candidateBestBand() usage below.
//   per-discipline started/evaluated counts a candidate if they have a
//     started/evaluated sim IN that discipline (s.discipline === entitlement slug).
// ─────────────────────────────────────────────────────────────────────

export type PartnerAnalytics = {
  funnel: { provisioned: number; started: number; evaluated: number; notStarted: number }
  verdictDistribution: { band: VerdictBand; count: number }[] // ordered by VERDICT_BANDS, per-candidate best
  candidatesWithVerdict: number // == funnel.evaluated (sum of distribution counts)
  byDiscipline: { discipline: string; candidates: number; started: number; evaluated: number }[]
}

/** A candidate's best (highest) verdict across their evaluated sims, or null if none evaluated. */
function candidateBestBand(c: PartnerCandidateWithProgress): string | null {
  return highestVerdictBand(c.simulations.map((s) => s.verdictBand).filter((b): b is string => !!b))
}

/** Pure aggregation over the (already partner-scoped) candidate-progress roster. No DB. */
export function computePartnerAnalytics(candidates: PartnerCandidateWithProgress[]): PartnerAnalytics {
  const provisioned = candidates.length
  const started = candidates.filter((c) => c.simulations.length > 0).length
  const evaluated = candidates.filter((c) => candidateBestBand(c) !== null).length

  // Verdict distribution — each candidate counted once by their BEST band.
  const distCount = new Map<string, number>()
  for (const c of candidates) {
    const best = candidateBestBand(c)
    if (best) distCount.set(best, (distCount.get(best) ?? 0) + 1)
  }
  const verdictDistribution = VERDICT_BANDS.map((band) => ({ band, count: distCount.get(band) ?? 0 }))

  // Per-discipline — union of entitled disciplines across the roster.
  const disciplineSet = new Set<string>()
  for (const c of candidates) for (const d of c.disciplines) disciplineSet.add(d)
  const byDiscipline = [...disciplineSet].sort().map((d) => {
    const entitled = candidates.filter((c) => c.disciplines.includes(d))
    return {
      discipline: d,
      candidates: entitled.length,
      started: entitled.filter((c) => c.simulations.some((s) => s.discipline === d)).length,
      evaluated: entitled.filter((c) => c.simulations.some((s) => s.discipline === d && s.verdictBand)).length,
    }
  })

  return {
    funnel: { provisioned, started, evaluated, notStarted: provisioned - started },
    verdictDistribution,
    candidatesWithVerdict: evaluated,
    byDiscipline,
  }
}

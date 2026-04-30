/**
 * PRIVACY GATE — read before adding columns to any return type here.
 *
 * This is the sole data access path for public portfolio pages. All data
 * returned by this function is visible to unauthenticated visitors on the
 * internet.
 *
 * Before adding any column to PortfolioData or its nested types, ask:
 *   - Is this column appropriate for anonymous public exposure?
 *   - Does it reveal internal scoring detail (raw_evaluation, criteria_scores,
 *     task_scores), personal information, or operational metadata?
 *   - Has the candidate consented to share it (i.e. does a visibility toggle
 *     control it)?
 *
 * Rules enforced in this file:
 *   1. Every Supabase query uses an explicit SELECT column list — no SELECT *.
 *   2. portfolio_simulation_visibility toggles are applied in JS before return.
 *      Columns gated by show_scores / show_feedback are stripped when false.
 *   3. raw_evaluation, task_scores, and criteria_scores are never fetched.
 *   4. profiles.user_type and credential_issuances.coach_id are never fetched.
 */

import { cache } from 'react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { achievingResult } from './highestVerdictBand';

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── Public return types ───────────────────────────────────────────────

export type ExternalLink = { label: string; url: string };

export type EvidenceItem = {
  id: string;
  title: string;
  description: string | null;
  evidence_type: 'image' | 'pdf' | 'document' | 'link';
  file_url: string | null;
  external_url: string | null;
  sort_order: number;
};

export type SimulationOnPortfolio = {
  simulationSlug: string;
  discipline: string;
  title: string;
  highestBand: string;
  achievedAt: string;
  // null when show_scores is false
  overallScore: number | null;
  // null when show_feedback is false
  feedbackText: string | null;
  credentialUrl: string | null;
  credentialStatus: 'issued' | 'pending' | 'failed' | null;
  evidence: EvidenceItem[];
  showScores: boolean;
  showFeedback: boolean;
};

export type PortfolioData = {
  profile: {
    slug: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    linkedin_url: string | null;
    external_links: ExternalLink[];
  };
  candidate: {
    fullName: string;
  };
  simulations: SimulationOnPortfolio[];
  stats: {
    simulationCount: number;
    credentialCount: number;
    disciplineCount: number;
  };
};

// Derives human-readable simulation titles from URL slugs.
// Extend when new simulations are added to the platform.
const SIMULATION_TITLES: Record<string, string> = {
  'product-strategy': 'Product Strategy',
};

// ── Main export ───────────────────────────────────────────────────────

/**
 * Fetches all public portfolio data for a given slug.
 * Returns null if the slug does not exist or the portfolio is not public.
 *
 * Wrapped in React.cache so generateMetadata and the page component both
 * call this without triggering a second DB round-trip in the same render.
 */
export const getPortfolioBySlug = cache(async (slug: string): Promise<PortfolioData | null> => {
  const supabase = getAdminSupabase();

  // ── Round 1: resolve slug → profile + user_id ─────────────────────
  const { data: profileRow, error: profileErr } = await supabase
    .from('portfolio_profiles')
    .select('user_id, slug, headline, bio, location, linkedin_url, external_links, is_public')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();

  if (profileErr || !profileRow) return null;

  const userId = profileRow.user_id as string;

  // ── Round 2: all parallel, keyed on user_id ────────────────────────
  const [
    { data: profilesRow },
    { data: evalRows },
    { data: credRows },
    { data: evidenceRows },
    { data: visibilityRows },
    { data: sessionRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle(),

    supabase
      .from('evaluation_results')
      .select('simulation_slug, verdict_band, overall_score, feedback_text, evaluated_at')
      .eq('user_id', userId),

    supabase
      .from('credential_issuances')
      .select('simulation_id, certifier_credential_url, status')
      .eq('candidate_user_id', userId),

    supabase
      .from('portfolio_evidence')
      .select('id, simulation_id, title, description, evidence_type, file_url, external_url, sort_order')
      .eq('user_id', userId)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true }),

    supabase
      .from('portfolio_simulation_visibility')
      .select('simulation_id, show_on_portfolio, show_scores, show_feedback')
      .eq('user_id', userId),

    supabase
      .from('simulation_sessions')
      .select('simulation_slug, discipline')
      .eq('user_id', userId)
      .eq('status', 'evaluated'),
  ]);

  // ── Build lookup maps ─────────────────────────────────────────────
  const credentialMap = new Map<string, { url: string | null; status: string }>();
  for (const c of credRows ?? []) {
    credentialMap.set(c.simulation_id, {
      url: c.certifier_credential_url ?? null,
      status: c.status,
    });
  }

  const visibilityMap = new Map<string, { showOnPortfolio: boolean; showScores: boolean; showFeedback: boolean }>();
  for (const v of visibilityRows ?? []) {
    visibilityMap.set(v.simulation_id, {
      showOnPortfolio: v.show_on_portfolio,
      showScores: v.show_scores,
      showFeedback: v.show_feedback,
    });
  }

  const disciplineMap = new Map<string, string>();
  for (const s of sessionRows ?? []) {
    disciplineMap.set(s.simulation_slug, s.discipline);
  }

  const evidenceMap = new Map<string, EvidenceItem[]>();
  for (const e of evidenceRows ?? []) {
    const bucket = evidenceMap.get(e.simulation_id) ?? [];
    bucket.push({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      evidence_type: e.evidence_type as EvidenceItem['evidence_type'],
      file_url: e.file_url ?? null,
      external_url: e.external_url ?? null,
      sort_order: e.sort_order,
    });
    evidenceMap.set(e.simulation_id, bucket);
  }

  // ── Group evaluation rows by simulation_slug ──────────────────────
  const resultsBySlug = new Map<string, typeof evalRows>();
  for (const r of evalRows ?? []) {
    const group = resultsBySlug.get(r.simulation_slug) ?? [];
    group.push(r);
    resultsBySlug.set(r.simulation_slug, group);
  }

  // ── Assemble simulations ──────────────────────────────────────────
  const simulations: SimulationOnPortfolio[] = [];

  for (const [simSlug, results] of resultsBySlug) {
    // Spec defaults: show_on_portfolio=true, show_scores=true, show_feedback=false
    const vis = visibilityMap.get(simSlug);
    const showOnPortfolio = vis?.showOnPortfolio ?? true;
    const showScores      = vis?.showScores      ?? true;
    const showFeedback    = vis?.showFeedback     ?? false;

    if (!showOnPortfolio) continue;

    const best = achievingResult(results ?? []);
    if (!best) continue;

    const credential = credentialMap.get(simSlug) ?? null;

    simulations.push({
      simulationSlug: simSlug,
      discipline:     disciplineMap.get(simSlug) ?? 'Unknown',
      title:          SIMULATION_TITLES[simSlug]  ?? simSlug,
      highestBand:    best.verdict_band,
      achievedAt:     best.evaluated_at,
      overallScore:   showScores ? (best.overall_score ?? null) : null,
      feedbackText:   showFeedback ? (best.feedback_text ?? null) : null,
      credentialUrl:  credential?.url ?? null,
      credentialStatus: (credential?.status as SimulationOnPortfolio['credentialStatus']) ?? null,
      evidence:       evidenceMap.get(simSlug) ?? [],
      showScores,
      showFeedback,
    });
  }

  // ── Stats (across visible simulations only) ───────────────────────
  const stats = {
    simulationCount: simulations.length,
    credentialCount: simulations.filter(s => s.credentialStatus === 'issued').length,
    disciplineCount: new Set(simulations.map(s => s.discipline)).size,
  };

  return {
    profile: {
      slug:           profileRow.slug,
      headline:       profileRow.headline       ?? null,
      bio:            profileRow.bio            ?? null,
      location:       profileRow.location       ?? null,
      linkedin_url:   profileRow.linkedin_url   ?? null,
      external_links: (profileRow.external_links as ExternalLink[]) ?? [],
    },
    candidate: {
      fullName: (profilesRow as { full_name?: string } | null)?.full_name ?? 'Candidate',
    },
    simulations,
    stats,
  };
});

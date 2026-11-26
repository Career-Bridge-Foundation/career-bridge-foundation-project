-- ============================================================
-- Career Bridge Foundation — Candidate CV/LinkedIn Scripts (Spec 17)
-- Migration: 20260903_001_create_candidate_cv_scripts.sql
-- ============================================================
-- Stores AI-generated CV bullet / discipline summary / LinkedIn text,
-- keyed off a candidate's own assessed evaluation results. Generated
-- once at credential-issuance time and persisted — never regenerated
-- on portfolio view (Spec 17 decision 9).
--
-- WRITE PATH / NON-ATOMICITY: rows here are written from the
-- generation pipeline (lib/cv-scripts/*), triggered best-effort from
-- POST /api/certifier/issue immediately after a credential_issuances
-- row is persisted. That write and this one are two separate Supabase
-- calls, not one transaction — a generation failure never rolls back
-- credential_issuances, and issuance is never blocked or failed by a
-- generation error. Recovery/backfill is POST /api/admin/cv-scripts/regenerate.
--
-- INSERT and service-role UPDATE bypass RLS via SUPABASE_SERVICE_ROLE_KEY
-- in server-side routes (candidates never write these rows directly).
--
-- Identity: candidate_user_id references auth.users(id) directly, matching
-- evaluation_results.user_id / simulation_sessions.user_id / credential_
-- issuances.candidate_user_id — all of which this table is joined against
-- at generation time — rather than portfolio_profiles(id), which would
-- require an extra join with no benefit here.
--
-- simulation_slug is TEXT (not a simulations.id UUID FK) to match
-- evaluation_results.simulation_slug / credential_issuances.simulation_id,
-- which are both slug-keyed.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- simulations: new authoring field (Spec 17 §5)
-- ────────────────────────────────────────────────────────────
-- Neutral, employer-free description of the simulation's setting,
-- e.g. "a simulated retail-banking environment". Authored deliberately —
-- NEVER derived from `company` or the brief text, which would leak the
-- fictional employer into a real candidate's CV/LinkedIn text. Nullable:
-- generation must fail closed (skip, no row written) when this is unset,
-- not fall back to `company`/`title`.
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS scenario_context TEXT;

-- ────────────────────────────────────────────────────────────
-- TABLE: candidate_cv_scripts
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.candidate_cv_scripts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                 TEXT        NOT NULL CHECK (scope IN ('simulation', 'discipline_summary')),
  simulation_slug       TEXT        REFERENCES public.simulations(slug),
  discipline            TEXT        NOT NULL,
  verdict_band          TEXT,
  completed_count       INTEGER,
  source_evaluation_id  UUID        REFERENCES public.evaluation_results(id),
  formats               JSONB       NOT NULL,
  generator_version     TEXT        NOT NULL,
  is_current            BOOLEAN     NOT NULL DEFAULT true,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.candidate_cv_scripts.formats IS
  'Shape: { cv_bullet, cv_summary, linkedin_project: { title, description, url }, linkedin_about }. cv_bullet only populated for scope=simulation; the rest only for scope=discipline_summary.';

-- Only one "current" row per (candidate, scope, simulation, discipline) —
-- retakes/regenerations supersede by flipping the prior row's is_current
-- to false before inserting the new one (Spec 17 §9).
CREATE UNIQUE INDEX candidate_cv_scripts_current_idx
  ON public.candidate_cv_scripts (candidate_user_id, scope, COALESCE(simulation_slug, ''), discipline)
  WHERE is_current;

CREATE INDEX idx_candidate_cv_scripts_candidate ON public.candidate_cv_scripts(candidate_user_id);
CREATE INDEX idx_candidate_cv_scripts_source_eval ON public.candidate_cv_scripts(source_evaluation_id);

ALTER TABLE public.candidate_cv_scripts ENABLE ROW LEVEL SECURITY;

-- Candidate reads own rows only. No owner INSERT/UPDATE policy — all
-- writes go through the service-role client from server-side generation
-- and admin routes. No partner/public read policy at all: partners have
-- zero access to this table, per Spec 17 decision 8 (partner-neutral output).
CREATE POLICY "candidate_cv_scripts_owner_select"
  ON public.candidate_cv_scripts FOR SELECT
  USING (auth.uid() = candidate_user_id);

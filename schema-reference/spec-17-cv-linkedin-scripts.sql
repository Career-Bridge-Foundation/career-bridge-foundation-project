-- ============================================================
-- SCHEMA REFERENCE — Spec 17 (CV & LinkedIn Scripts)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth
-- — see CLAUDE.md). Identical to
-- supabase/migrations/20260903_001_create_candidate_cv_scripts.sql;
-- kept here per the schema-reference/spec-NN-*.sql convention.
--
-- Live columns on the tables this feature reads/writes were verified
-- directly (service-role introspection) on 2026-09-03 — no drift found
-- vs. what's assumed below, except portfolio_profiles, whose migration
-- file (20260512_001_create_portfolio_tables.sql) is known-stale; this
-- feature does not write to portfolio_profiles, only reads its `slug`.
--
--  Step 0 — verify no existing candidate_cv_scripts / scenario_context
--  Step 1 — simulations.scenario_context (new authoring field)
--  Step 2 — candidate_cv_scripts table
--  Step 3 — indexes
--  Step 4 — enable RLS
--  Step 5 — RLS policy

-- ── Step 0 ──────────────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_name = 'simulations' and column_name = 'scenario_context';
-- select 1 from information_schema.tables
--   where table_name = 'candidate_cv_scripts';
-- Both should return zero rows before proceeding.

-- ── Step 1 ──────────────────────────────────────────────────
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS scenario_context TEXT;

-- ── Step 2 ──────────────────────────────────────────────────
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

-- ── Step 3 ──────────────────────────────────────────────────
CREATE UNIQUE INDEX candidate_cv_scripts_current_idx
  ON public.candidate_cv_scripts (candidate_user_id, scope, COALESCE(simulation_slug, ''), discipline)
  WHERE is_current;

CREATE INDEX idx_candidate_cv_scripts_candidate ON public.candidate_cv_scripts(candidate_user_id);
CREATE INDEX idx_candidate_cv_scripts_source_eval ON public.candidate_cv_scripts(source_evaluation_id);

-- ── Step 4 ──────────────────────────────────────────────────
ALTER TABLE public.candidate_cv_scripts ENABLE ROW LEVEL SECURITY;

-- ── Step 5 ──────────────────────────────────────────────────
-- Candidate reads own rows only. No owner INSERT/UPDATE policy — all
-- writes go through the service-role client from server-side generation
-- and admin routes. No partner/public read policy: partners have zero
-- access to this table, per Spec 17 decision 8 (partner-neutral output).
CREATE POLICY "candidate_cv_scripts_owner_select"
  ON public.candidate_cv_scripts FOR SELECT
  USING (auth.uid() = candidate_user_id);

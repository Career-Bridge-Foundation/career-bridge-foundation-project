-- ============================================================
-- SCHEMA REFERENCE — Spec 14 (Practice Trial Simulations)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth
-- — see CLAUDE.md). Run one numbered step at a time to isolate
-- failures; confirm with SELECT before proceeding to the next.
--
-- Depends on Spec 15 (schema-reference/spec-15-assessment-credits.sql)
-- Step 1 — simulations.simulation_type already exists in production;
-- verify with the SELECT below before running Step 1 here.
--
--  Step 0  — verify simulations.simulation_type exists
--  Step 1  — practice_runs
--  Step 2  — enforce_practice_run_simulation_type trigger
--  Step 3  — indexes
--  Step 4  — enable RLS
--  Step 5  — RLS policies
--  Step 6  — practice-content read policies on simulations / simulation_prompts
--  Step 7  — drop assistant_message_count (Spec 14 upgrade: assistant removed)
-- ============================================================


-- ============================================================
-- STEP 0 — Verify simulations.simulation_type exists
-- Spec 15 added this column ahead of Spec 14 going live (see that
-- file's Step 1 comment). Run this first; if it errors, apply
-- spec-15-assessment-credits.sql Step 1 before continuing here.
-- ============================================================

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'simulations' AND column_name = 'simulation_type';


-- ============================================================
-- STEP 1 — practice_runs
-- One row per practice attempt. No unique constraint on
-- (candidate_id, simulation_id) — replays are expected and each
-- gets its own row; prior runs are retained (Spec 14 decision 3).
--
-- feedback is intentionally schema-less beyond "no band/score/verdict
-- key" (Spec 14 decision 6) — enforced by the API layer that writes
-- it (POST /api/practice/runs/:id/submit), not by a DB constraint,
-- since jsonb has no native "key must be absent" check.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practice_runs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id             UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  simulation_id            UUID        NOT NULL REFERENCES public.simulations(id),
  submitted_at             TIMESTAMPTZ,
  feedback                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 2 — enforce_practice_run_simulation_type trigger
-- Structural guarantee behind Spec 14 decision 7: a practice run
-- cannot be created against an assessed simulation even if the API
-- guard (lib/practice/getPracticeSimulation.ts) is bypassed or has
-- a bug. Mirrors the same guard already enforced in application code
-- by the activate_simulation RPC in the opposite direction
-- (schema-reference/spec-15-activate-rpc.sql, Step 1 guard).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_practice_run_simulation_type()
RETURNS TRIGGER AS $$
DECLARE
  v_sim_type TEXT;
BEGIN
  SELECT simulation_type INTO v_sim_type
  FROM public.simulations
  WHERE id = NEW.simulation_id;

  IF v_sim_type IS DISTINCT FROM 'practice' THEN
    RAISE EXCEPTION 'practice_runs.simulation_id must reference a simulation with simulation_type = practice (got %)', v_sim_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_practice_run_simulation_type ON public.practice_runs;
CREATE TRIGGER trg_enforce_practice_run_simulation_type
  BEFORE INSERT ON public.practice_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_practice_run_simulation_type();


-- ============================================================
-- STEP 3 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_practice_runs_candidate
  ON public.practice_runs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_practice_runs_simulation
  ON public.practice_runs(simulation_id);


-- ============================================================
-- STEP 4 — Enable RLS
-- ============================================================

ALTER TABLE public.practice_runs ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 5 — RLS policies
--
-- Candidate reads own rows only, same pattern as
-- credit_ledger_candidate_select (spec-15-assessment-credits.sql,
-- Step 12). No partner SELECT policy at all — practice performance
-- is not evidence and must not become a partner-visible signal
-- about a candidate (Spec 14 "Data model" section, explicit).
--
-- No candidate INSERT/UPDATE policy: all writes to practice_runs go
-- through the service-role client in app/api/practice/**, same
-- pattern as evaluation_results writes in app/api/evaluate/route.ts.
-- ============================================================

CREATE POLICY practice_runs_candidate_select ON public.practice_runs FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- STEP 6 — Practice-content read policies on simulations / simulation_prompts
--
-- Gap found during manual testing (not anticipated during design): a later
-- migration (supabase/migrations/20260605_001_simulation_content_rls.sql)
-- locked SELECT on `simulations` and `simulation_prompts` behind
-- candidate_entitlements (discipline-level, pre-Spec-15 model) and DROPPED
-- the old permissive/public read policies entirely. That's correct for
-- assessed content (candidates shouldn't read a brief before paying), but
-- it silently blocks Practice Trials too — hooks/useSimulationContent.ts
-- queries both tables directly from the browser client, and a candidate
-- with no entitlement for that discipline gets zero rows back, which
-- surfaces as "Practice trial not found." even though the row and its
-- prompts exist and are fully published.
--
-- Fix: additive read policies scoped to simulation_type = 'practice' only.
-- RLS SELECT policies are OR'd together, so this does not loosen access to
-- assessed rows — entitled_candidate_read_simulations /
-- entitled_candidate_read_prompts still gate those exactly as before.
-- This is the DB-level enforcement of Spec 14 decision 2 ("No entitlement
-- check ... Availability does not depend on cohort membership, partner, or
-- purchase history") for the two tables the practice runtime reads from
-- directly (as opposed to practice_runs / the app/api/practice/** routes,
-- which use the service-role client and were never subject to this gate).
-- ============================================================

CREATE POLICY practice_trial_public_read_simulations ON public.simulations FOR SELECT
  USING (simulation_type = 'practice');

CREATE POLICY practice_trial_public_read_prompts ON public.simulation_prompts FOR SELECT
  USING (
    simulation_id IN (
      SELECT id FROM public.simulations WHERE simulation_type = 'practice'
    )
  );


-- ============================================================
-- STEP 7 — Drop assistant_message_count (Spec 14 upgrade: AI
-- Simulation Assistant removed entirely from Practice Trials — see
-- upgraded spec decision 4: "No AI Simulation Assistant on Practice
-- Trials... at any message volume." There is no assistant and
-- therefore no cap to enforce, so the counter column is dropped.
-- Not executed automatically — run manually via Supabase Dashboard
-- SQL Editor once the corresponding app code has been verified
-- locally.
-- ============================================================

ALTER TABLE public.practice_runs DROP COLUMN assistant_message_count;

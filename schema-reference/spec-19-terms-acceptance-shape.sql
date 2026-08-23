-- ============================================================
-- SCHEMA REFERENCE — Spec 19 amendment to Spec 15 (narrow scope)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth —
-- see CLAUDE.md). Run one numbered step at a time.
--
-- Apply AFTER spec-15-assessment-credits.sql.
--
-- Context: Spec 19 (Candidate Acceptance & Community Provisioning)
-- amends Spec 15's acceptance model — it replaces the single
-- terms_acceptances table with a typed, partner-scoped, versioned
-- candidate_terms_acceptances table, since a candidate can owe
-- acceptance to two different documents from two different
-- contracting parties (Evidentize's platform terms vs. a partner's
-- programme terms), each with an independent version history.
--
-- SCOPE OF THIS FILE — deliberately narrow. It adopts the DATA SHAPE
-- only, so routes built now don't have to be migrated + backfilled
-- later. It does NOT build:
--   - the acceptance-gate middleware (candidate blocked until accepted)
--   - first-login capture timing (Spec 19 moves capture off activation;
--     this repo still captures at activation/checkout, unchanged)
--   - Circle community provisioning
--   - terms-document publishing / versioning workflow
-- Those remain full Spec 19 scope, tracked separately.
--
-- terms_acceptances (Spec 15) is NOT dropped or renamed — it is live
-- and simulation_activations / activate_simulation() do not reference
-- it directly for anything except the historical write this migration
-- removes. Left in place for any existing rows; no new code writes to
-- it after this migration lands. Superseded going forward by
-- candidate_terms_acceptances below.
--
-- Deviation from Spec 19's literal column list: this table also
-- carries immediate_performance_consent and user_agent, which Spec 19's
-- data model section doesn't list but Spec 15 requires ("terms
-- acceptance... alongside immediate-performance consent"). Keeping it
-- here avoids regressing Spec 15 functionality while adopting the new
-- shape early.
--
-- document_hash is nullable: hashing "the exact text presented"
-- requires a versioned terms-document store, which is full Spec 19
-- scope (terms_documents table, publishing workflow) and not built
-- here. Populate once that exists.
--
--  Step 1 — candidate_terms_acceptances
--  Step 2 — indexes
--  Step 3 — enable RLS
--  Step 4 — RLS policies
-- ============================================================


-- ============================================================
-- STEP 1 — candidate_terms_acceptances
-- Append-only. No update path — a version change re-prompts and
-- inserts a new row; nothing in history is ever edited in place.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.candidate_terms_acceptances (
  id                             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id                   UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  document_type                  TEXT        NOT NULL
                                    CHECK (document_type IN ('platform_terms', 'partner_programme_terms')),
  partner_id                     UUID        REFERENCES public.partners(id),
  version                        TEXT        NOT NULL,
  document_hash                  TEXT,
  immediate_performance_consent  BOOLEAN     NOT NULL DEFAULT false,
  accepted_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address                     INET,
  user_agent                     TEXT,
  -- partner_id is NULL for platform_terms (Postgres treats NULLs as
  -- distinct for UNIQUE, so this still correctly prevents a duplicate
  -- platform_terms row per candidate/version — the only case this repo
  -- writes today).
  UNIQUE (candidate_id, document_type, partner_id, version)
);


-- ============================================================
-- STEP 2 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_candidate_terms_acceptances_candidate
  ON public.candidate_terms_acceptances(candidate_id);


-- ============================================================
-- STEP 3 — Enable RLS
-- ============================================================

ALTER TABLE public.candidate_terms_acceptances ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4 — RLS policies
-- Candidates read their own rows only — mirrors the terms_acceptances
-- policy in spec-15-assessment-credits.sql Step 12.
-- ============================================================

CREATE POLICY candidate_terms_acceptances_candidate_select ON public.candidate_terms_acceptances FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );

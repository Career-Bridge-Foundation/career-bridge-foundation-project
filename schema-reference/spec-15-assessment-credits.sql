-- ============================================================
-- SCHEMA REFERENCE — Spec 15 (Assessment Credits & Entitlement)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth
-- — see CLAUDE.md). Run one numbered step at a time to isolate
-- failures; confirm with SELECT before proceeding to the next.
--
-- Apply order matters: tables with FK dependencies must come
-- after their targets.
--
--  Step  1 — simulations.simulation_type  (new column)
--  Step  2 — portfolio_profiles.country   (new column)
--  Step  3 — cohorts                      (stub; FK target for codes + ledger)
--  Step  4 — partner_allocations
--  Step  5 — sponsor_codes
--  Step  6 — code_redemptions
--  Step  7 — credit_ledger
--  Step  8 — simulation_activations
--  Step  9 — terms_acceptances
--  Step 10 — indexes
--  Step 11 — enable RLS
--  Step 12 — RLS policies
--
-- Circular FK note (credit_ledger ↔ simulation_activations):
--   credit_ledger.source_activation_id references simulation_activations
--   but simulation_activations.credit_ledger_id references credit_ledger.
--   Postgres cannot enforce both as FK constraints simultaneously during
--   CREATE TABLE. source_activation_id is therefore a plain UUID (no FK
--   constraint); referential integrity is maintained by the atomic
--   activation RPC (Spec 15 Phase 2), which inserts both rows and
--   backfills source_activation_id within a single transaction.
--
-- portfolio_profiles.country write restriction:
--   Postgres has no column-level RLS. The existing owner_update policy
--   technically permits candidates to write the country column. Enforce
--   the "partner-admin only" constraint at the API layer: the candidate-
--   facing profile update endpoint must exclude country from accepted
--   fields. The partner-admin endpoint is the only write path.
-- ============================================================


-- ============================================================
-- STEP 1 — simulations.simulation_type
-- Distinguishes assessed scenarios from Practice Trials (Spec 14).
-- Spec 14 is not yet live; this column is added here because the
-- activation guard on POST /api/candidate/activate depends on it.
-- Existing rows default to 'assessed' — correct for all current content.
-- ============================================================

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS simulation_type TEXT NOT NULL DEFAULT 'assessed'
    CHECK (simulation_type IN ('assessed', 'practice'));


-- ============================================================
-- STEP 2 — portfolio_profiles.country
-- ISO 3166-1 alpha-2. Captured by partner at invite; editable
-- afterwards by partner-admin only (enforced at API layer — see
-- note above). Used to derive pricing_region at runtime; never
-- stored as a column (adding a market = mapping change, not migration).
-- ============================================================

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS country CHAR(2);


-- ============================================================
-- STEP 3 — cohorts
-- Stub table: provides the FK target for sponsor_codes.cohort_id
-- and credit_ledger.cohort_id. Full cohort enrolment logic ships
-- with the bulk provisioning feature; this table is the anchor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cohorts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID        NOT NULL REFERENCES public.partners(id),
  name        TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 4 — partner_allocations
-- One row per contract period per partner. The active allocation
-- is the row where now() falls between period_start and period_end.
-- committed_credits is the ceiling; buffer = ceiling × buffer_pct/100.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_allocations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID        NOT NULL REFERENCES public.partners(id),
  committed_credits INTEGER     NOT NULL CHECK (committed_credits > 0),
  buffer_pct        INTEGER     NOT NULL DEFAULT 10 CHECK (buffer_pct >= 0),
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);


-- ============================================================
-- STEP 5 — sponsor_codes
-- Minted by partner-admins self-serve. Ceiling enforcement happens
-- at mint time (reserved_value = credits_per_redemption × max_redemptions)
-- — never at redemption. code is stored lowercase; CHECK enforces
-- normalization so case-insensitive uniqueness holds on the UNIQUE index.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sponsor_codes (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id             UUID        NOT NULL REFERENCES public.partners(id),
  code                   TEXT        NOT NULL UNIQUE CHECK (code = lower(code)),
  credits_per_redemption INTEGER     NOT NULL CHECK (credits_per_redemption > 0),
  max_redemptions        INTEGER     NOT NULL CHECK (max_redemptions > 0),
  redemptions_used       INTEGER     NOT NULL DEFAULT 0,
  cohort_id              UUID        REFERENCES public.cohorts(id) ON DELETE SET NULL,
  expires_at             TIMESTAMPTZ NOT NULL,
  created_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at             TIMESTAMPTZ
);


-- ============================================================
-- STEP 6 — code_redemptions
-- One row per (code, candidate) pair. Unique constraint prevents
-- a candidate from redeeming the same code twice. credits_granted
-- is denormalised from sponsor_codes at redemption time so that
-- future edits to the code definition do not alter history.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id         UUID        NOT NULL REFERENCES public.sponsor_codes(id),
  candidate_id    UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  credits_granted INTEGER     NOT NULL CHECK (credits_granted > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code_id, candidate_id)
);


-- ============================================================
-- STEP 7 — credit_ledger
-- Append-only. Balance = SUM(delta) for a candidate. Never store
-- a mutable balance column. partner_id on each row records the
-- credit origin for attribution and allocation accounting.
-- source_activation_id is a plain UUID (no FK) — see circular
-- FK note at the top of this file.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  partner_id            UUID        NOT NULL REFERENCES public.partners(id),
  cohort_id             UUID        REFERENCES public.cohorts(id) ON DELETE SET NULL,
  delta                 INTEGER     NOT NULL,
  reason                TEXT        NOT NULL
                          CHECK (reason IN ('code_redemption', 'purchase', 'activation', 'adjustment')),
  source_code_id        UUID        REFERENCES public.sponsor_codes(id) ON DELETE SET NULL,
  source_activation_id  UUID,
  source_transaction_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 8 — simulation_activations
-- One row per (candidate, simulation, attempt). A retake increments
-- attempt_number and requires a new credit (new credit_ledger debit).
-- terms_version records which version of T&Cs the candidate accepted.
-- Unique constraint prevents double-activation on the same attempt.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.simulation_activations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  simulation_id    UUID        NOT NULL REFERENCES public.simulations(id),
  attempt_number   INTEGER     NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  credit_ledger_id UUID        NOT NULL REFERENCES public.credit_ledger(id),
  terms_version    TEXT        NOT NULL,
  activated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, simulation_id, attempt_number)
);


-- ============================================================
-- STEP 9 — terms_acceptances
-- Versioned record of T&C acceptance, captured once at first
-- activation. immediate_performance_consent is required by the
-- modal alongside the T&C link (Spec 15 UI section).
-- ip_address is INET type to support both IPv4 and IPv6.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id                  UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  terms_version                 TEXT        NOT NULL,
  accepted_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address                    INET,
  immediate_performance_consent BOOLEAN     NOT NULL DEFAULT false
);


-- ============================================================
-- STEP 10 — Indexes
-- ============================================================

-- cohorts
CREATE INDEX IF NOT EXISTS idx_cohorts_partner
  ON public.cohorts(partner_id);

-- partner_allocations
CREATE INDEX IF NOT EXISTS idx_partner_allocations_partner
  ON public.partner_allocations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_allocations_active
  ON public.partner_allocations(partner_id, period_start, period_end);

-- sponsor_codes
CREATE INDEX IF NOT EXISTS idx_sponsor_codes_partner
  ON public.sponsor_codes(partner_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_codes_active
  ON public.sponsor_codes(partner_id)
  WHERE revoked_at IS NULL;

-- code_redemptions
CREATE INDEX IF NOT EXISTS idx_code_redemptions_code
  ON public.code_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_candidate
  ON public.code_redemptions(candidate_id);

-- credit_ledger
CREATE INDEX IF NOT EXISTS idx_credit_ledger_candidate
  ON public.credit_ledger(candidate_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_partner
  ON public.credit_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_candidate_time
  ON public.credit_ledger(candidate_id, created_at DESC);

-- simulation_activations
CREATE INDEX IF NOT EXISTS idx_simulation_activations_candidate
  ON public.simulation_activations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_simulation_activations_candidate_sim
  ON public.simulation_activations(candidate_id, simulation_id);

-- terms_acceptances
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_candidate
  ON public.terms_acceptances(candidate_id);


-- ============================================================
-- STEP 11 — Enable RLS
-- ============================================================

ALTER TABLE public.cohorts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_redemptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances     ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 12 — RLS policies
--
-- Pattern mirrors existing partner policies (20260531 migration):
--   JWT app_metadata check OR user_roles table check — both code
--   paths are covered so neither placement of role data causes
--   silent rejection.
--
-- Partner scoping uses:
--   partner_id IN (SELECT partner_id FROM public.user_roles WHERE user_id = auth.uid())
-- This mirrors the partner_invites SELECT policy (05.6 schema ref).
--
-- credit_ledger: partner-admins do NOT get row-level SELECT access.
--   Individual ledger rows reveal candidate spend patterns — the spec
--   explicitly forbids partner-admins from reading individual rows.
--   Aggregate consumption figures are served via the API using the
--   service-role client (bypasses RLS), scoped in code to the partner.
-- ============================================================

-- ── cohorts ─────────────────────────────────────────────────

CREATE POLICY cohorts_partner_all ON public.cohorts FOR ALL
  USING (
    partner_id IN (
      SELECT partner_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'partner'
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'partner'
      )
    )
  );

CREATE POLICY cohorts_super_admin_all ON public.cohorts FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── partner_allocations ─────────────────────────────────────
-- Partner-admins read their own allocation; only super_admin writes.

CREATE POLICY allocations_partner_select ON public.partner_allocations FOR SELECT
  USING (
    partner_id IN (
      SELECT partner_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'partner'
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'partner'
      )
    )
  );

CREATE POLICY allocations_super_admin_all ON public.partner_allocations FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── sponsor_codes ───────────────────────────────────────────
-- Partner-admins manage codes for their own partner only.

CREATE POLICY sponsor_codes_partner_all ON public.sponsor_codes FOR ALL
  USING (
    partner_id IN (
      SELECT partner_id FROM public.user_roles WHERE user_id = auth.uid()
    )
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'partner'
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'partner'
      )
    )
  );

CREATE POLICY sponsor_codes_super_admin_all ON public.sponsor_codes FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── code_redemptions ────────────────────────────────────────
-- Candidates read their own redemption records only.

CREATE POLICY code_redemptions_candidate_select ON public.code_redemptions FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );


-- ── credit_ledger ───────────────────────────────────────────
-- Candidates read their own rows only.
-- Partner-admins: no SELECT policy — aggregates served via API (service role).

CREATE POLICY credit_ledger_candidate_select ON public.credit_ledger FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );


-- ── simulation_activations ──────────────────────────────────
-- Candidates read their own activations only.

CREATE POLICY simulation_activations_candidate_select ON public.simulation_activations FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );


-- ── terms_acceptances ───────────────────────────────────────
-- Candidates read their own acceptances only.

CREATE POLICY terms_acceptances_candidate_select ON public.terms_acceptances FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );

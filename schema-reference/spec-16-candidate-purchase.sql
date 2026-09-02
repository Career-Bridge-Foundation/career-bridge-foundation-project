-- ============================================================
-- SCHEMA REFERENCE — Spec 16 (Candidate Purchase & Payment)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth
-- — see CLAUDE.md). Run one numbered step at a time to isolate
-- failures; confirm with SELECT before proceeding to the next.
--
-- Depends on Spec 15 (schema-reference/spec-15-assessment-credits.sql)
-- — partners, portfolio_profiles, credit_ledger must already exist.
--
--  Step 1   — partner_stripe_config   (per-partner webhook secret + return URL)
--  Step 2   — partner_pack_prices     (Stripe price IDs per region × pack)
--  Step 3   — pack_transactions       (purchase ledger, drives credit_ledger mint)
--  Step 3.5 — credit_ledger.source_transaction_id FK backfill
--  Step 4   — indexes
--  Step 5   — enable RLS
--  Step 6   — RLS policies
--  Step 7   — seed Career Bridge Foundation config (placeholders — fill in real IDs)
--
-- Launch scope note: single first-party partner (Career Bridge
-- Foundation), using the platform's existing STRIPE_SECRET_KEY /
-- STRIPE_WEBHOOK_SECRET. partner_stripe_config and partner_pack_prices
-- are built as multi-partner-ready tables but only seeded with one
-- partner's rows for now. Static Payment Link fallback (for partners
-- whose Stripe secret key Evidentize never holds) is deferred.
-- ============================================================


-- ============================================================
-- STEP 1 — partner_stripe_config
-- One row per partner. Holds the webhook signing secret used to
-- verify events on POST /api/webhooks/stripe/:partnerId, and the
-- partner's white-label return URL (candidates must land back on
-- the partner's own host after Stripe Checkout, never the
-- Evidentize host — see Spec 16 "Payment flow" step 5).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_stripe_config (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id             UUID        NOT NULL UNIQUE REFERENCES public.partners(id),
  webhook_signing_secret TEXT        NOT NULL,
  return_url             TEXT        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 2 — partner_pack_prices
-- Stripe Price IDs per (partner × pricing_region × pack). Four
-- minimum at launch: Standard/Africa Access × Builder/Professional.
-- Price objects must be created in the Stripe Dashboard first —
-- this table only records the resulting IDs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_pack_prices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID        NOT NULL REFERENCES public.partners(id),
  pricing_region  TEXT        NOT NULL CHECK (pricing_region IN ('STANDARD', 'AFRICA_ACCESS', 'SPONSORED', 'PARTNER_SPECIFIC')),
  pack            TEXT        NOT NULL CHECK (pack IN ('builder', 'professional')),
  stripe_price_id TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, pricing_region, pack)
);


-- ============================================================
-- STEP 3 — pack_transactions
-- One row per completed Stripe Checkout session. Required for
-- Value Contribution Allocation reporting (Commercial Model §19)
-- — without this table the 50/50 split is not computable from
-- platform data. stripe_event_id is the idempotency key: the
-- webhook handler must insert-or-reject on this before minting
-- credit_ledger, or a Stripe retry doubles a candidate's balance.
--
-- stripe_fee / fx_cost are NOT present on checkout.session.completed
-- — the handler (or a reconciliation job) must fetch them from the
-- associated balance transaction (payment_intent -> charge ->
-- balance_transaction). Until that's populated these columns are NULL.
--
-- pricing_region is frozen at purchase time (a later region change
-- on the candidate's profile must not alter historic transactions).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pack_transactions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id                UUID        NOT NULL REFERENCES public.portfolio_profiles(id) ON DELETE CASCADE,
  partner_id                  UUID        NOT NULL REFERENCES public.partners(id),
  pricing_region              TEXT        NOT NULL CHECK (pricing_region IN ('STANDARD', 'AFRICA_ACCESS', 'SPONSORED', 'PARTNER_SPECIFIC')),
  pack                        TEXT        NOT NULL CHECK (pack IN ('builder', 'professional')),
  credits_purchased           INTEGER     NOT NULL CHECK (credits_purchased > 0),
  stripe_event_id             TEXT        NOT NULL UNIQUE,
  stripe_session_id           TEXT        NOT NULL,
  stripe_payment_intent_id    TEXT,
  presentment_currency        TEXT        NOT NULL,
  gross_amount                INTEGER     NOT NULL, -- minor units (e.g. pence), as charged
  settlement_currency         TEXT,
  settlement_amount           INTEGER,               -- minor units, as settled
  stripe_fee                  INTEGER,               -- minor units, from balance transaction
  fx_cost                     INTEGER,               -- minor units, from balance transaction
  net_received                INTEGER,               -- minor units, from balance transaction
  region_mismatch             BOOLEAN     NOT NULL DEFAULT false, -- true if paid price didn't match candidate's derived region at mint time
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 3.5 — credit_ledger.source_transaction_id FK backfill
-- Spec 15 left this column as a plain UUID (reserved for this spec).
-- Unlike source_activation_id, there is no circularity here —
-- pack_transactions never references credit_ledger — so this can be
-- a real FK constraint, added now that the target table exists.
-- ============================================================

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_source_transaction_id_fkey
  FOREIGN KEY (source_transaction_id) REFERENCES public.pack_transactions(id);


-- ============================================================
-- STEP 4 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_partner_pack_prices_partner
  ON public.partner_pack_prices(partner_id);

CREATE INDEX IF NOT EXISTS idx_pack_transactions_candidate
  ON public.pack_transactions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pack_transactions_partner
  ON public.pack_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_pack_transactions_partner_time
  ON public.pack_transactions(partner_id, created_at DESC);


-- ============================================================
-- STEP 5 — Enable RLS
-- ============================================================

ALTER TABLE public.partner_stripe_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_pack_prices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_transactions     ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 6 — RLS policies
--
-- Pattern mirrors Spec 15 (schema-reference/spec-15-assessment-
-- credits.sql, Step 12): JWT app_metadata check OR user_roles
-- table check.
--
-- partner_stripe_config / partner_pack_prices: contain Stripe
-- config, not candidate financial data. No candidate access.
-- Super-admin manages all; partner-admins read (not write) their
-- own partner's rows — writes go through a super-admin-reviewed
-- admin flow, not self-serve, since this spec ships single-partner.
--
-- pack_transactions: candidates read their own rows only.
-- Partner-admins DO get row-level SELECT for their own partner_id
-- (unlike credit_ledger) — the spec explicitly calls for partner-
-- admins to read aggregate transaction data for their own tenant;
-- aggregation (SUMs) happens in the API layer over this RLS-scoped
-- read, not via service-role bypass.
-- ============================================================

-- ── partner_stripe_config ───────────────────────────────────

CREATE POLICY partner_stripe_config_partner_select ON public.partner_stripe_config FOR SELECT
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

CREATE POLICY partner_stripe_config_super_admin_all ON public.partner_stripe_config FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── partner_pack_prices ─────────────────────────────────────

CREATE POLICY partner_pack_prices_partner_select ON public.partner_pack_prices FOR SELECT
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

CREATE POLICY partner_pack_prices_super_admin_all ON public.partner_pack_prices FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ── pack_transactions ───────────────────────────────────────

CREATE POLICY pack_transactions_candidate_select ON public.pack_transactions FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM public.portfolio_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY pack_transactions_partner_select ON public.pack_transactions FOR SELECT
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

CREATE POLICY pack_transactions_super_admin_all ON public.pack_transactions FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ============================================================
-- STEP 7 — Seed: Career Bridge Foundation
-- Replace the placeholder values before running. webhook_signing_secret
-- should match STRIPE_WEBHOOK_SECRET in the deployed environment.
-- stripe_price_id values come from Stripe Dashboard -> Product catalog
-- (create the four Price objects there first).
-- ============================================================

-- INSERT INTO public.partner_stripe_config (partner_id, webhook_signing_secret, return_url)
-- SELECT id, '<STRIPE_WEBHOOK_SECRET value>', 'https://<career-bridge-return-host>/purchase/return'
-- FROM public.partners WHERE slug = 'career-bridge-foundation'
-- ON CONFLICT (partner_id) DO NOTHING;

-- INSERT INTO public.partner_pack_prices (partner_id, pricing_region, pack, stripe_price_id)
-- SELECT id, region, pack, price_id FROM public.partners,
--   (VALUES
--     ('STANDARD',       'builder',      'price_<standard_builder>'),
--     ('STANDARD',       'professional', 'price_<standard_professional>'),
--     ('AFRICA_ACCESS',  'builder',      'price_<africa_builder>'),
--     ('AFRICA_ACCESS',  'professional', 'price_<africa_professional>')
--   ) AS v(region, pack, price_id)
-- WHERE slug = 'career-bridge-foundation'
-- ON CONFLICT (partner_id, pricing_region, pack) DO NOTHING;

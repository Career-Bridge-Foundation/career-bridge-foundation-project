-- ============================================================
-- SCHEMA REFERENCE — Amendment: Candidate Country Capture,
-- Pricing Tier & Currency Presentment
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth —
-- see CLAUDE.md). Run one numbered step at a time.
--
-- Depends on spec-15-assessment-credits.sql (portfolio_profiles.country
-- already exists — Step 2 there). This file adds the fields Spec 15
-- didn't: capture at invite (partner_tokens.country) and the
-- edit-lock-after-first-purchase mechanism (country_locked_at).
--
-- Verify partner_tokens' actual columns against production before
-- running Step 1 — it is not recorded elsewhere in schema-reference/
-- (only inferred from lib/partners/mint.ts and app/api/redeem/route.ts).
--
--  Step 1 — partner_tokens.country
--  Step 2 — portfolio_profiles.country_locked_at
-- ============================================================


-- ============================================================
-- STEP 1 — partner_tokens.country
-- Captured at mint (POST /api/partner/tokens), carried onto
-- portfolio_profiles on redemption (POST /api/redeem). No default —
-- the API layer rejects a mint request with no country; this column
-- has no DEFAULT and no NOT NULL, since existing unredeemed tokens
-- predate this column and must not be invalidated by it.
-- ============================================================

ALTER TABLE public.partner_tokens
  ADD COLUMN IF NOT EXISTS country CHAR(2);


-- ============================================================
-- STEP 2 — portfolio_profiles.country_locked_at
-- Set the first time a candidate's pack_transactions row is written
-- (app/api/webhooks/stripe/[partnerId]/route.ts). Before this is set,
-- a partner-admin may edit country freely; after, only super-admin.
-- Closes the arbitrage path of flipping a candidate to Africa Access,
-- letting them buy at the lower price, then flipping back.
-- ============================================================

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS country_locked_at TIMESTAMPTZ;


-- ============================================================
-- Backfill note (not a runnable step — do this deliberately, once)
-- ============================================================
-- Amendment requires existing candidates backfilled before Spec 16
-- goes live. There is no country-of-record for pre-amendment
-- candidates to backfill FROM (it was never captured), so this is a
-- data-collection exercise for Career Bridge/Join Momentum, not a SQL
-- step — coordinate with partner-admins to fill in country via the
-- new PATCH /api/partner/candidates/:id/country endpoint (Amendment
-- Step 4 of the close-out plan) for candidates provisioned before
-- this migration landed.

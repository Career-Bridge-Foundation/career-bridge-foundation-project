-- ============================================================
-- SCHEMA REFERENCE — Spec 18 (Sponsor Codes / Partner Console)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth —
-- see CLAUDE.md). Run one numbered step at a time.
--
-- Depends on spec-15-assessment-credits.sql (sponsor_codes,
-- code_redemptions must already exist).
--
-- Naming divergence from the spec text: Spec 18 names the redemption-
-- events table sponsor_code_redemptions. The live table is
-- code_redemptions (Spec 15). Not renamed here — avoids a breaking
-- migration + rewrite of Spec 15's already-shipped RLS/FKs for a
-- cosmetic difference. code_redemptions IS that table.
--
-- Code format change — HEADS UP for any already-minted test codes:
-- codes now store as prefix+8-char-suffix CONCATENATED, no hyphen
-- (e.g. "cbf25a3f9k2m"), not the old "abcd-ef3h" shape. Redemption
-- normalizes user input by stripping hyphens/whitespace before
-- lookup (spec: "strip whitespace and hyphens and compare case-
-- insensitively") — storing without a hyphen removes the ambiguity
-- of what counts as "the same code" once hyphens are stripped from
-- one side but not the other. The hyphen is re-inserted only for
-- display, using the stored `prefix` column to know where. Any
-- codes minted under the old format before this migration will not
-- redeem correctly against the new normalization and should be
-- re-minted.
--
-- status is NOT fully stored per the spec's literal wording ("status
-- maintained by the redemption/expiry/revoke transactions, not
-- computed at read time"). revoked and exhausted genuinely are
-- transitioned by their triggering transaction (revoke, the
-- redemption UPDATE that hits max_redemptions) and so ARE stored.
-- expired is NOT stored — there is no cron/sweep in this codebase
-- (same precedent as partner_invites.status in schema-reference/05.6-
-- partner-invites.sql, which derives 'expired' at read time for the
-- identical reason: no sweep job exists). Effective status at read
-- time = stored status, UNLESS stored='active' AND expires_at <= now(),
-- in which case effective status is 'expired'. All application code
-- (list endpoint, ceiling reserved calc) must apply this rule
-- consistently rather than trusting the stored column alone for the
-- expired case.
--
--  Step 1 — pgcrypto (CSPRNG source for the mint RPC)
--  Step 2 — sponsor_codes new columns
--  Step 3 — indexes
--  Step 4 — backfill status on existing rows
-- ============================================================


-- ============================================================
-- STEP 1 — pgcrypto
-- gen_random_bytes() is the CSPRNG source the mint RPC uses for code
-- generation (spec-18-mint-rpc.sql) — Math.random()-equivalent
-- Postgres random() is explicitly disallowed (security-critical:
-- "must be a CSPRNG, not Math.random()"). Usually already enabled on
-- Supabase by default; IF NOT EXISTS makes this idempotent either way.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- STEP 2 — sponsor_codes new columns
-- ============================================================

ALTER TABLE public.sponsor_codes
  ADD COLUMN IF NOT EXISTS label      TEXT,
  ADD COLUMN IF NOT EXISTS batch_id   UUID,          -- NULL for shared codes; groups a unique-code mint batch
  ADD COLUMN IF NOT EXISTS prefix     TEXT,           -- partner-supplied, uppercase, <=8 chars; NULL on pre-migration rows
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'revoked')),
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note       TEXT;

-- created_by (Spec 15) already serves as the spec's "minted_by" — not
-- duplicated under a second name.


-- ============================================================
-- STEP 3 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sponsor_codes_batch
  ON public.sponsor_codes(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_codes_partner_status
  ON public.sponsor_codes(partner_id, status);


-- ============================================================
-- STEP 4 — Backfill status on existing rows
-- New rows default to 'active' going forward; this brings existing
-- rows in line with their actual revoked/exhausted state so the
-- stored column is correct from day one, not just for new mints.
-- ============================================================

UPDATE public.sponsor_codes
SET status = 'revoked'
WHERE revoked_at IS NOT NULL
  AND status <> 'revoked';

UPDATE public.sponsor_codes
SET status = 'exhausted'
WHERE revoked_at IS NULL
  AND redemptions_used >= max_redemptions
  AND status <> 'exhausted';

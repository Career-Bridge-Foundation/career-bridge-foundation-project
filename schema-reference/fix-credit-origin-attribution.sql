-- ============================================================
-- SCHEMA REFERENCE — Fix: carry credit origin through to consumption
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the
-- Supabase Dashboard SQL Editor (production is source of truth —
-- see CLAUDE.md).
--
-- Bug this fixes (flagged independently by Spec 18 acceptance
-- criterion 5 and the August 2026 handover doc's "verify before
-- building" list): the activation debit written by activate_simulation()
-- always recorded partner_id = the candidate's provisioning partner,
-- with no record of WHICH grant (sponsor code vs self-purchase) the
-- spent credit actually came from. GET /api/partner/allocation sums
-- all reason='activation' debits by partner_id — so a candidate's
-- Spec 16 self-purchase was silently counted as sponsored consumption
-- against the partner's ceiling, over-billing them for credits they
-- never sponsored.
--
-- Fix: debited_reason records which grant type (code_redemption /
-- purchase) the debit drew down, resolved at debit time by the RPC.
-- lib/entitlement/ceiling.ts then filters consumed-against-ceiling to
-- debited_reason = 'code_redemption' only.
--
--  Step 1 — credit_ledger.debited_reason
--  Step 2 — index
-- (Step 3, the activate_simulation() RPC change, lives in
--  spec-15-activate-rpc.sql — this file only adds the column it needs.)
-- ============================================================


-- ============================================================
-- STEP 1 — credit_ledger.debited_reason
-- Nullable: only ever set on reason='activation' rows. NULL on every
-- grant row (code_redemption / purchase / adjustment) and on any
-- pre-existing activation row written before this migration — those
-- historic debits cannot be retroactively attributed without a
-- backfill pass and are simply excluded from the fixed consumed
-- calculation until then (undercounts consumed, never overcounts —
-- the safe direction for a partner-billing figure).
-- ============================================================

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS debited_reason TEXT
    CHECK (debited_reason IS NULL OR debited_reason IN ('code_redemption', 'purchase'));


-- ============================================================
-- STEP 2 — Index
-- Backs the filtered consumed-credits query in getAllocationState().
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_credit_ledger_partner_debited_reason
  ON public.credit_ledger(partner_id, reason, debited_reason);

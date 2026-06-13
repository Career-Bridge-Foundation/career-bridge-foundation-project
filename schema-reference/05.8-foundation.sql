-- ============================================================
-- SCHEMA REFERENCE — Spec 05.8 (partner/mentor foundation)
-- ============================================================
-- THIS FILE IS NOT EXECUTED BY ANY MIGRATION TOOL.
--
-- These statements were applied manually via the Supabase
-- Dashboard SQL Editor, following the project convention that
-- PRODUCTION is the source of truth (see CLAUDE.md). They are
-- recorded here, verbatim, so the repository reflects what was
-- actually applied to production — nothing in supabase/migrations
-- runs them. Do not point a migration runner at this file.
--
-- Applied: 2026-06-13 (Dashboard). Recorded by: 05.8 work.
-- ============================================================


-- ── user_roles CHECK constraint: widen to 7 roles (add 'mentor') ──
-- The original constraint (migration 20260514_001) allowed only
-- 'candidate', 'admin', 'super_admin', 'reviewer'. 'content_developer'
-- and 'partner' were added later via Dashboard; 05.8 adds 'mentor'.
-- This is the exact form applied:

ALTER TABLE public.user_roles
  DROP CONSTRAINT user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN (
    'candidate',
    'admin',
    'super_admin',
    'reviewer',
    'content_developer',
    'partner',
    'mentor'
  ));


-- ============================================================
-- SCHEMA DRIFT NOTE — portfolio_profiles (migration 20260512_001)
-- ============================================================
-- Migration 20260512_001_create_portfolio_tables.sql is OUT OF
-- DATE versus production. Verified against live prod on 2026-06-13:
--
--   * Migration defines  portfolio_profiles.candidate_user_id
--     → PROD column is    portfolio_profiles.user_id  (FK auth.users.id)
--   * Migration defines  portfolio_profiles.display_name
--     → DOES NOT EXIST in prod. The candidate display name lives on
--       profiles.full_name (join profiles.id = portfolio_profiles.user_id).
--   * Candidate email is NOT on profiles — it comes from auth.users
--     (service-role admin API only).
--
-- The 05.8 candidate-progress primitive (lib/partners/candidateProgress.ts)
-- was built on the VERIFIED production columns above, NOT on the migration
-- file. Anyone reading supabase/migrations should treat 20260512_001 as
-- out-of-date for portfolio_profiles until it is reconciled.
-- ============================================================

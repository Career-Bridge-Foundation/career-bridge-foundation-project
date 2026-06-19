-- ============================================================
-- Evidentize — Portfolio Templates (Spec 9)
-- Migration: 20260618_001_add_portfolio_template.sql
-- ============================================================
-- Adds a template selection column to portfolio_profiles.
-- Default 'professional' ensures all existing portfolios
-- continue to render the current layout without any edit.
-- ============================================================

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'professional';

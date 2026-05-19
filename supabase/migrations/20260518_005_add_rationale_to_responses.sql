-- ============================================================
-- Career Bridge Foundation
-- Migration: 20260518_005_add_rationale_to_responses.sql
--
-- Adds rationale_text to simulation_responses so the URL-type
-- task "Rationale" textarea is persisted alongside the link URL.
-- ============================================================

ALTER TABLE public.simulation_responses
  ADD COLUMN IF NOT EXISTS rationale_text TEXT;

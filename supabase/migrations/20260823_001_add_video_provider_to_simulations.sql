-- ============================================================
-- Career Bridge — Mux video briefings
-- Migration: 20260823_001_add_video_provider_to_simulations.sql
-- ============================================================
-- Adds Mux playback fields to simulations. Both columns are
-- nullable: a simulation with no video_provider keeps using
-- video_url (or the placeholder) exactly as before.
--
-- Already applied to production; this file exists to keep the
-- repo in sync. Written to be re-runnable.
-- ============================================================

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS video_provider TEXT;

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS video_id TEXT;

ALTER TABLE public.simulations
  DROP CONSTRAINT IF EXISTS simulations_video_provider_check;

ALTER TABLE public.simulations
  ADD CONSTRAINT simulations_video_provider_check
  CHECK (video_provider IS NULL OR video_provider IN ('mux', 'native'));

COMMENT ON COLUMN public.simulations.video_id IS
  'Mux playback ID (not an asset ID) when video_provider = ''mux''.';

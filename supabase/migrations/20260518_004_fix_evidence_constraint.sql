-- ============================================================
-- Career Bridge Foundation
-- Migration: 20260518_004_fix_evidence_constraint.sql
--
-- 1. Adds is_evidence to simulation_session_attachments to
--    distinguish primary submission files/URLs (from the
--    ResponseForm) from supplementary Supporting Evidence
--    attachments.
--
-- 2. Drops the uq_session_task_type unique constraint which
--    prevented multiple evidence files per task.
--
-- 3. Creates a partial unique index that re-enforces the
--    one-file-per-task rule only for primary submissions
--    (is_evidence = false).
-- ============================================================

ALTER TABLE public.simulation_session_attachments
  ADD COLUMN IF NOT EXISTS is_evidence BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.simulation_session_attachments
  DROP CONSTRAINT IF EXISTS uq_session_task_type;

-- Primary submission: still unique per (session, task, type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_task_type_primary
  ON public.simulation_session_attachments(session_id, task_id, type)
  WHERE NOT is_evidence;

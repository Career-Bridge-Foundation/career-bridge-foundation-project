-- ============================================================
-- Career Bridge Foundation
-- Migration: 20260518_002_simulation_attachments.sql
--
-- 1. Adds rubric_id + rubric_version to evaluation_results
--    (referenced by app/api/evaluate/route.ts but missing from
--    the original schema migration).
--
-- 2. Creates simulation_session_attachments — one row per file
--    or URL submitted by a candidate for a specific task within
--    a simulation session.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PATCH evaluation_results: add rubric tracking columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.evaluation_results
  ADD COLUMN IF NOT EXISTS rubric_id      UUID,
  ADD COLUMN IF NOT EXISTS rubric_version INTEGER;

-- ────────────────────────────────────────────────────────────
-- TABLE: simulation_session_attachments
-- Stores file uploads and URL submissions made by a candidate
-- against a specific task in a simulation session.
--
-- Path structure for files:
--   {user_id}/{session_id}/{task_id}/{timestamp}_{filename}
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.simulation_session_attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL
                      REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  task_id           INTEGER     NOT NULL CHECK (task_id >= 1 AND task_id <= 10),
  type              TEXT        NOT NULL CHECK (type IN ('file', 'url')),
  file_path         TEXT,
  url               TEXT,
  original_filename TEXT,
  mime_type         TEXT,
  size_bytes        BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exactly one of file_path or url must be set, matching the type
  CONSTRAINT chk_file_or_url CHECK (
    (type = 'file' AND file_path IS NOT NULL AND url IS NULL) OR
    (type = 'url'  AND url IS NOT NULL       AND file_path IS NULL)
  ),

  -- One attachment per (session, task, type) — upsert target
  CONSTRAINT uq_session_task_type UNIQUE (session_id, task_id, type)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_sim_attachments_session_id
  ON public.simulation_session_attachments(session_id);

CREATE INDEX idx_sim_attachments_session_task
  ON public.simulation_session_attachments(session_id, task_id);

-- ── Row-Level Security ────────────────────────────────────────
ALTER TABLE public.simulation_session_attachments ENABLE ROW LEVEL SECURITY;

-- Candidates can manage attachments belonging to their own sessions
CREATE POLICY "candidate_manage_own_attachments"
  ON public.simulation_session_attachments
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.simulation_sessions
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.simulation_sessions
      WHERE user_id = auth.uid()
    )
  );

-- Admins and reviewers can read all attachments
CREATE POLICY "admin_read_all_attachments"
  ON public.simulation_session_attachments
  FOR SELECT
  USING (is_admin());

-- ============================================================
-- Career Bridge Foundation — Debriefs Table (Spec 2)
-- Migration: 20260526_001_create_debriefs_table.sql
-- ============================================================
-- Creates the debriefs table for the VAPI voice debrief feature.
-- Stores the questions Claude generated, the VAPI call state,
-- the raw transcript, the structured summary, and the candidate
-- approval status for each simulation session.
--
-- is_visible controls whether an approved debrief is shown on
-- the public portfolio (/portfolio/[slug]). Defaults to true;
-- candidate can toggle off via /portfolio/edit.
--
-- INSERT and service-role UPDATE (webhook transcript/summary)
-- bypass RLS via SUPABASE_SERVICE_ROLE_KEY in server-side routes.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE: debriefs
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.debriefs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id               UUID        NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  evaluation_id            UUID        REFERENCES public.evaluation_results(id),
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN (
                               'pending',
                               'in_progress',
                               'pending_review',
                               'approved',
                               'discarded',
                               'failed'
                             )),
  is_visible               BOOLEAN     NOT NULL DEFAULT true,
  vapi_call_id             TEXT,
  questions_generated      JSONB,
  raw_transcript           TEXT,
  structured_summary       JSONB,
  candidate_edited_summary JSONB,
  approved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_debriefs_user_id    ON public.debriefs(user_id);
CREATE INDEX idx_debriefs_session_id ON public.debriefs(session_id);
CREATE INDEX idx_debriefs_status     ON public.debriefs(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.debriefs ENABLE ROW LEVEL SECURITY;

-- Candidate can read their own debriefs (all statuses)
CREATE POLICY "debriefs_owner_select"
  ON public.debriefs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Candidate can update their own debriefs (approve / edit / discard / toggle visibility)
CREATE POLICY "debriefs_owner_update"
  ON public.debriefs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Public can read approved, visible debriefs where the portfolio is public
CREATE POLICY "debriefs_public_read"
  ON public.debriefs
  FOR SELECT
  USING (
    status = 'approved'
    AND is_visible = true
    AND EXISTS (
      SELECT 1 FROM public.portfolio_profiles pp
      WHERE pp.user_id = debriefs.user_id
        AND pp.is_public = true
    )
  );

-- ============================================================
-- updated_at TRIGGER
-- Reuses the existing public.update_updated_at() function
-- defined in 20260420_001_create_all_tables.sql.
-- ============================================================

DROP TRIGGER IF EXISTS trg_debriefs_updated_at ON public.debriefs;
CREATE TRIGGER trg_debriefs_updated_at
  BEFORE UPDATE ON public.debriefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

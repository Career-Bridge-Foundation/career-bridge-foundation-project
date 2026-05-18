-- ══════════════════════════════════════════════════════════════
-- simulation_comments: section-level reviewer commenting
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.simulation_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id   UUID        NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  reviewer_id     UUID        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  -- Optional display name / initials the reviewer provides
  reviewer_label  TEXT,
  -- e.g. 'brief', 'prompt-<prompt_id>', 'rubric'
  section_key     TEXT        NOT NULL,
  -- The text the reviewer highlighted before commenting
  selected_text   TEXT        NOT NULL,
  comment         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.simulation_comments ENABLE ROW LEVEL SECURITY;

-- Reviewers, admins, and super_admins can read all comments on simulations
CREATE POLICY "simulation_comments_select"
  ON public.simulation_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('reviewer', 'admin', 'super_admin')
    )
  );

-- Reviewers (and admins) can insert comments attributed to themselves
CREATE POLICY "simulation_comments_insert"
  ON public.simulation_comments FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('reviewer', 'admin', 'super_admin')
    )
  );

-- Only the author can delete their own comment
CREATE POLICY "simulation_comments_delete"
  ON public.simulation_comments FOR DELETE
  USING (reviewer_id = auth.uid());

-- Index for fast lookup by simulation
CREATE INDEX IF NOT EXISTS simulation_comments_simulation_idx
  ON public.simulation_comments (simulation_id, section_key, created_at);

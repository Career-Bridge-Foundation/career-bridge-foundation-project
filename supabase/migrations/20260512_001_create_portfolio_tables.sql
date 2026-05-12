-- ============================================================
-- Career Bridge Foundation — Portfolio Tables (Phase 1A)
-- Migration: 20260512_001_create_portfolio_tables.sql
-- ============================================================
-- Creates the three portfolio tables, their indexes, RLS
-- policies, updated_at triggers, the ensure_portfolio_profile()
-- function and its trigger on evaluation_results, and the
-- storage RLS policies for the portfolio-evidence bucket.
--
-- The storage bucket itself (portfolio-evidence) is created
-- manually via the Supabase Dashboard, not in SQL. See
-- docs/CareerBridge_Portfolio_Phase1A_Migration_Spec.md.
--
-- Column mapping notes:
--   - evaluation_results.user_id   -> portfolio_profiles.candidate_user_id
--   - profiles.id (not user_id)    is the FK to auth.users
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE 1: portfolio_profiles
-- One row per candidate. Candidate-controlled portfolio metadata.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.portfolio_profiles (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                  TEXT         NOT NULL UNIQUE,
  display_name          TEXT         NOT NULL,
  bio                   TEXT,
  social_links          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_public             BOOLEAN      NOT NULL DEFAULT true,
  show_default_scores   BOOLEAN      NOT NULL DEFAULT true,
  show_default_feedback BOOLEAN      NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(candidate_user_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 2: portfolio_evidence
-- Files or external links attached by a candidate to a specific
-- simulation. evidence_file_or_url enforces the type/payload
-- relationship exactly per the spec.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.portfolio_evidence (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug     TEXT         NOT NULL,
  evidence_type       TEXT         NOT NULL CHECK (evidence_type IN ('file', 'url')),
  file_path           TEXT,
  external_url        TEXT,
  title               TEXT         NOT NULL,
  description         TEXT,
  mime_type           TEXT,
  file_size_bytes     BIGINT,
  is_visible          BOOLEAN      NOT NULL DEFAULT true,
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT evidence_file_or_url CHECK (
    (evidence_type = 'file' AND file_path IS NOT NULL AND external_url IS NULL)
    OR
    (evidence_type = 'url' AND external_url IS NOT NULL AND file_path IS NULL)
  )
);

-- ────────────────────────────────────────────────────────────
-- TABLE 3: portfolio_simulation_visibility
-- Sparse per-simulation overrides of portfolio_profiles defaults.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.portfolio_simulation_visibility (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug     TEXT         NOT NULL,
  show_on_portfolio   BOOLEAN      NOT NULL DEFAULT true,
  show_scores         BOOLEAN      NOT NULL DEFAULT true,
  show_feedback       BOOLEAN      NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(candidate_user_id, simulation_slug)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- portfolio_profiles indexes
CREATE INDEX idx_portfolio_profiles_candidate_user_id ON public.portfolio_profiles(candidate_user_id);
CREATE INDEX idx_portfolio_profiles_slug              ON public.portfolio_profiles(slug);
CREATE INDEX idx_portfolio_profiles_is_public         ON public.portfolio_profiles(is_public) WHERE is_public = true;

-- portfolio_evidence indexes
CREATE INDEX idx_portfolio_evidence_candidate_user_id ON public.portfolio_evidence(candidate_user_id);
CREATE INDEX idx_portfolio_evidence_simulation_slug   ON public.portfolio_evidence(simulation_slug);
CREATE INDEX idx_portfolio_evidence_candidate_simulation
  ON public.portfolio_evidence(candidate_user_id, simulation_slug);
CREATE INDEX idx_portfolio_evidence_visible
  ON public.portfolio_evidence(candidate_user_id, is_visible)
  WHERE is_visible = true;

-- portfolio_simulation_visibility indexes
CREATE INDEX idx_portfolio_simulation_visibility_candidate
  ON public.portfolio_simulation_visibility(candidate_user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.portfolio_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_evidence              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_simulation_visibility ENABLE ROW LEVEL SECURITY;

-- ── portfolio_profiles ──────────────────────────────────────
CREATE POLICY "portfolio_profiles_public_read"
  ON public.portfolio_profiles
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "portfolio_profiles_owner_read"
  ON public.portfolio_profiles
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_profiles_owner_update"
  ON public.portfolio_profiles
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

-- No INSERT policy: rows are created only via the SECURITY DEFINER
-- trigger function below. Deletes happen only via CASCADE from auth.users.

-- ── portfolio_evidence ──────────────────────────────────────
CREATE POLICY "portfolio_evidence_public_read"
  ON public.portfolio_evidence
  FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM public.portfolio_profiles pp
      WHERE pp.candidate_user_id = portfolio_evidence.candidate_user_id
      AND pp.is_public = true
    )
  );

CREATE POLICY "portfolio_evidence_owner_read"
  ON public.portfolio_evidence
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_evidence_owner_insert"
  ON public.portfolio_evidence
  FOR INSERT
  WITH CHECK (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_evidence_owner_update"
  ON public.portfolio_evidence
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_evidence_owner_delete"
  ON public.portfolio_evidence
  FOR DELETE
  USING (auth.uid() = candidate_user_id);

-- ── portfolio_simulation_visibility ─────────────────────────
CREATE POLICY "portfolio_simulation_visibility_public_read"
  ON public.portfolio_simulation_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolio_profiles pp
      WHERE pp.candidate_user_id = portfolio_simulation_visibility.candidate_user_id
      AND pp.is_public = true
    )
  );

CREATE POLICY "portfolio_simulation_visibility_owner_read"
  ON public.portfolio_simulation_visibility
  FOR SELECT
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_simulation_visibility_owner_insert"
  ON public.portfolio_simulation_visibility
  FOR INSERT
  WITH CHECK (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_simulation_visibility_owner_update"
  ON public.portfolio_simulation_visibility
  FOR UPDATE
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "portfolio_simulation_visibility_owner_delete"
  ON public.portfolio_simulation_visibility
  FOR DELETE
  USING (auth.uid() = candidate_user_id);

-- ============================================================
-- updated_at TRIGGERS
-- Reuse the existing public.update_updated_at() function defined
-- in 20260420_001_create_all_tables.sql.
-- ============================================================

DROP TRIGGER IF EXISTS trg_portfolio_profiles_updated_at ON public.portfolio_profiles;
CREATE TRIGGER trg_portfolio_profiles_updated_at
  BEFORE UPDATE ON public.portfolio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_evidence_updated_at ON public.portfolio_evidence;
CREATE TRIGGER trg_portfolio_evidence_updated_at
  BEFORE UPDATE ON public.portfolio_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_simulation_visibility_updated_at ON public.portfolio_simulation_visibility;
CREATE TRIGGER trg_portfolio_simulation_visibility_updated_at
  BEFORE UPDATE ON public.portfolio_simulation_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- AUTO-CREATION FUNCTION + TRIGGER
-- Creates a portfolio_profiles row for a candidate the first
-- time an evaluation_results row is inserted for them.
--
-- evaluation_results uses NEW.user_id (existing schema). The
-- new portfolio_profiles uses candidate_user_id for consistency
-- with credential_issuances. profiles is joined via id (no
-- separate user_id column on profiles).
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_portfolio_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_display_name TEXT;
  v_slug TEXT;
  v_slug_base TEXT;
  v_slug_suffix INTEGER := 0;
BEGIN
  -- Idempotency guard
  IF EXISTS (
    SELECT 1 FROM public.portfolio_profiles
    WHERE candidate_user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Existing profiles table joins on id (no user_id column)
  SELECT full_name INTO v_display_name
  FROM public.profiles
  WHERE id = NEW.user_id
  LIMIT 1;

  IF v_display_name IS NULL OR v_display_name = '' THEN
    v_display_name := 'Career Bridge Candidate';
  END IF;

  v_slug_base := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);

  IF v_slug_base = '' THEN
    v_slug_base := 'candidate-' || substring(NEW.user_id::text, 1, 8);
  END IF;

  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.portfolio_profiles WHERE slug = v_slug) LOOP
    v_slug_suffix := v_slug_suffix + 1;
    v_slug := v_slug_base || '-' || v_slug_suffix;

    -- Safety: prevent pathological infinite loops
    IF v_slug_suffix > 9999 THEN
      v_slug := v_slug_base || '-' || substring(NEW.user_id::text, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.portfolio_profiles (
    candidate_user_id,
    slug,
    display_name,
    is_public,
    show_default_scores,
    show_default_feedback
  ) VALUES (
    NEW.user_id,
    v_slug,
    v_display_name,
    true,
    true,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_portfolio_profile ON public.evaluation_results;
CREATE TRIGGER trg_ensure_portfolio_profile
  AFTER INSERT ON public.evaluation_results
  FOR EACH ROW EXECUTE FUNCTION public.ensure_portfolio_profile();

-- ============================================================
-- STORAGE RLS POLICIES — portfolio-evidence bucket
-- The bucket itself is created manually via the Supabase
-- Dashboard (public, 25MB file size limit). These policies are
-- attached to storage.objects.
--
-- File path structure: {candidate_user_id}/{evidence_id}.{ext}
-- ============================================================

CREATE POLICY "storage_portfolio_evidence_owner_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_portfolio_evidence_owner_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_portfolio_evidence_owner_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'portfolio-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_portfolio_evidence_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio-evidence');

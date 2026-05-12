-- ============================================================
-- Career Bridge Foundation — Backfill portfolio_profiles
-- Migration: 20260512_002_backfill_portfolio_profiles.sql
-- ============================================================
-- One-time backfill: create a portfolio_profiles row for every
-- existing candidate that has at least one evaluation_results
-- row but no portfolio_profiles row yet.
--
-- Idempotent — safe to re-run. Uses the same slug generation
-- logic as the ensure_portfolio_profile() trigger function so
-- that auto-created and backfilled rows are indistinguishable.
--
-- Column mapping notes:
--   - evaluation_results.user_id   -> portfolio_profiles.candidate_user_id
--   - profiles.id (not user_id)    is the FK to auth.users
-- The cursor aliases er.user_id AS candidate_user_id for
-- readability inside the loop.
-- ============================================================

DO $$
DECLARE
  v_candidate RECORD;
  v_display_name TEXT;
  v_slug TEXT;
  v_slug_base TEXT;
  v_slug_suffix INTEGER;
  v_inserted_count INTEGER := 0;
BEGIN
  FOR v_candidate IN
    SELECT DISTINCT er.user_id AS candidate_user_id
    FROM public.evaluation_results er
    LEFT JOIN public.portfolio_profiles pp ON pp.candidate_user_id = er.user_id
    WHERE pp.id IS NULL
  LOOP
    SELECT full_name INTO v_display_name
    FROM public.profiles
    WHERE id = v_candidate.candidate_user_id
    LIMIT 1;

    IF v_display_name IS NULL OR v_display_name = '' THEN
      v_display_name := 'Career Bridge Candidate';
    END IF;

    v_slug_base := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(both '-' from v_slug_base);

    IF v_slug_base = '' THEN
      v_slug_base := 'candidate-' || substring(v_candidate.candidate_user_id::text, 1, 8);
    END IF;

    v_slug := v_slug_base;
    v_slug_suffix := 0;
    WHILE EXISTS (SELECT 1 FROM public.portfolio_profiles WHERE slug = v_slug) LOOP
      v_slug_suffix := v_slug_suffix + 1;
      v_slug := v_slug_base || '-' || v_slug_suffix;
      IF v_slug_suffix > 9999 THEN
        v_slug := v_slug_base || '-' || substring(v_candidate.candidate_user_id::text, 1, 8);
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
      v_candidate.candidate_user_id,
      v_slug,
      v_display_name,
      true,
      true,
      false
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % portfolio_profiles created', v_inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Migration: candidate acceptance ENFORCEMENT (Spec 19)
--
-- Deliberately isolated from 20260824_001 (the data model, seed, and
-- self-service candidate/admin API surface, which changes nothing about who
-- can access what). This file adds the ONE function middleware.ts calls to
-- gate every candidate request — the part that actually changes live
-- behavior. Both documents seeded in 001 are still is_active = false at this
-- point, so candidate_has_outstanding_terms() returns false for everyone
-- until a real version is published — this migration is safe to apply ahead
-- of that, but review it together with the middleware.ts diff, not the 001
-- migration.

CREATE OR REPLACE FUNCTION candidate_has_outstanding_terms()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  p_user_id UUID := auth.uid();
  active_platform_version TEXT;
  link_col TEXT;
  profile_id UUID;
  ent RECORD;
  active_partner_version TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform terms.
  SELECT version INTO active_platform_version
  FROM terms_documents WHERE document_type = 'platform_terms' AND is_active = true LIMIT 1;

  IF active_platform_version IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM candidate_terms_acceptances
      WHERE candidate_id = p_user_id AND document_type = 'platform_terms' AND version = active_platform_version
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Partner programme terms, resolved via whichever portfolio_profiles link
  -- column is real in this environment (see 20260824_001's comment on the
  -- same ambiguity, applied identically here).
  SELECT column_name INTO link_col
  FROM information_schema.columns
  WHERE table_name = 'portfolio_profiles' AND column_name IN ('user_id', 'candidate_user_id')
  ORDER BY (column_name = 'user_id') DESC
  LIMIT 1;

  IF link_col IS NULL THEN
    RETURN false; -- can't resolve partner association; platform check above already passed
  END IF;

  EXECUTE format('SELECT id FROM portfolio_profiles WHERE %I = $1 LIMIT 1', link_col)
    INTO profile_id USING p_user_id;

  IF profile_id IS NULL THEN
    RETURN false;
  END IF;

  FOR ent IN
    SELECT DISTINCT granted_by_partner FROM candidate_entitlements
    WHERE candidate_id = profile_id AND revoked_at IS NULL
  LOOP
    SELECT version INTO active_partner_version
    FROM terms_documents
    WHERE document_type = 'partner_programme_terms' AND partner_id = ent.granted_by_partner AND is_active = true
    LIMIT 1;

    IF active_partner_version IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM candidate_terms_acceptances
        WHERE candidate_id = p_user_id AND document_type = 'partner_programme_terms'
          AND partner_id = ent.granted_by_partner AND version = active_partner_version
      ) THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION candidate_has_outstanding_terms() TO authenticated;

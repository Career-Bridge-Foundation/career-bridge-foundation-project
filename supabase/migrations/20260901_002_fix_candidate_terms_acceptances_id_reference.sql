-- Migration: fix a systemic wrong assumption about candidate_terms_acceptances.candidate_id
--
-- Confirmed empirically against the live database: candidate_terms_acceptances
-- .candidate_id has its FK on portfolio_profiles(id), NOT auth.users(id) as
-- 20260824_001's own CREATE TABLE comment assumed ("= auth.uid() of the
-- accepting candidate" — wrong). A live test insert using a real auth.users
-- id was rejected with: "Key (candidate_id)=(...) is not present in table
-- portfolio_profiles."
--
-- That wrong assumption was baked into every function/view that touches this
-- column, all fixed here:
--   - record_candidate_acceptance() inserted auth.uid() directly — every
--     acceptance attempt failed outright with the FK violation.
--   - candidate_has_outstanding_terms() compared candidate_id = auth.uid()
--     directly for BOTH the platform-terms and partner-terms checks — always
--     false-positive "outstanding" for everyone, forever, even immediately
--     after a (hypothetically) successful acceptance. The candidate-facing
--     lib/terms/acceptanceStatus.ts (fixed separately, same commit) had the
--     identical bug.
--   - partner_candidate_acceptance_status joined
--     candidate_terms_acceptances.candidate_id against portfolio_profiles's
--     user_id column instead of its id column — permanently showed every
--     candidate as not-accepted on the partner roster regardless of reality.

-- ── record_candidate_acceptance(): resolve profile_id, insert that ──────────
CREATE OR REPLACE FUNCTION record_candidate_acceptance(
  p_acceptances JSONB, -- [{ "document_type": "...", "partner_id": "..."|null, "version": "...", "document_hash": "..." }]
  p_ip TEXT,
  p_user_agent TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  auth_user_id UUID := auth.uid();
  profile_id UUID;
BEGIN
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO profile_id FROM portfolio_profiles WHERE user_id = auth_user_id LIMIT 1;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'no portfolio profile exists for this candidate yet';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_acceptances)
  LOOP
    INSERT INTO candidate_terms_acceptances
      (candidate_id, document_type, partner_id, version, document_hash, ip_address, user_agent)
    VALUES (
      profile_id,
      item ->> 'document_type',
      NULLIF(item ->> 'partner_id', '')::uuid,
      item ->> 'version',
      item ->> 'document_hash',
      NULLIF(p_ip, '')::inet,
      p_user_agent
    )
    ON CONFLICT (
      candidate_id, document_type,
      COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid),
      version
    ) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION record_candidate_acceptance(JSONB, TEXT, TEXT) TO authenticated;

-- ── candidate_has_outstanding_terms(): resolve profile_id BEFORE both checks ─
CREATE OR REPLACE FUNCTION candidate_has_outstanding_terms()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  p_user_id UUID := auth.uid();
  profile_id UUID;
  active_platform_version TEXT;
  ent RECORD;
  active_partner_version TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO profile_id FROM portfolio_profiles WHERE user_id = p_user_id LIMIT 1;

  -- No profile yet (e.g. staff roles, or a brand-new signup that hasn't
  -- redeemed/created one) — nothing could possibly be recorded against them
  -- yet either way (the FK requires a profile_id to insert), so there is
  -- nothing to gate on.
  IF profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform terms.
  SELECT version INTO active_platform_version
  FROM terms_documents WHERE document_type = 'platform_terms' AND is_active = true LIMIT 1;

  IF active_platform_version IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM candidate_terms_acceptances
      WHERE candidate_id = profile_id AND document_type = 'platform_terms' AND version = active_platform_version
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Partner programme terms — only partners where at least one entitlement
  -- row requires their terms.
  FOR ent IN
    SELECT DISTINCT granted_by_partner FROM candidate_entitlements
    WHERE candidate_id = profile_id AND revoked_at IS NULL
      AND requires_programme_terms = true
  LOOP
    SELECT version INTO active_partner_version
    FROM terms_documents
    WHERE document_type = 'partner_programme_terms' AND partner_id = ent.granted_by_partner AND is_active = true
    LIMIT 1;

    IF active_partner_version IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM candidate_terms_acceptances
        WHERE candidate_id = profile_id AND document_type = 'partner_programme_terms'
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

-- ── partner_candidate_acceptance_status: join on pp.id, not pp.user_id ──────
-- No longer needs the dynamic link_col lookup 20260824_001 used — pp.id is a
-- static column name that's always present.
CREATE OR REPLACE VIEW partner_candidate_acceptance_status AS
SELECT
  ce.granted_by_partner AS partner_id,
  pp.id                 AS candidate_id,
  bool_or(cta.document_type = 'platform_terms') AS platform_terms_accepted,
  bool_or(cta.document_type = 'partner_programme_terms' AND cta.partner_id = ce.granted_by_partner) AS programme_terms_accepted,
  max(cta.accepted_at)  AS last_accepted_at
FROM candidate_entitlements ce
JOIN portfolio_profiles pp ON pp.id = ce.candidate_id
LEFT JOIN candidate_terms_acceptances cta ON cta.candidate_id = pp.id
WHERE ce.revoked_at IS NULL
GROUP BY ce.granted_by_partner, pp.id;

GRANT SELECT ON partner_candidate_acceptance_status TO authenticated;

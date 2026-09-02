-- Migration: make provisioning enqueue atomic with the acceptance write
--
-- Spec 19's own API surface: "Records rows and enqueues provisioning
-- atomically with respect to the acceptance write." The original
-- record_candidate_acceptance() (20260824_001) only did the first half —
-- the app route did the provisioning-flag flip as a separate best-effort
-- step AFTER the RPC returned, wrapped in try/catch. If that second step
-- ever threw, the acceptance was recorded but provisioning silently never
-- got queued — exactly the inconsistent state "atomically" was meant to
-- rule out. Moved into the same function/transaction here instead.
--
-- Uses portfolio_profiles.user_id directly (not the dynamic
-- information_schema lookup 20260824_001 used for the partner-facing view)
-- — confirmed via a direct query against the live database that user_id is
-- the real column, so no need for the defensive fallback here.

CREATE OR REPLACE FUNCTION record_candidate_acceptance(
  p_acceptances JSONB, -- [{ "document_type": "...", "partner_id": "..."|null, "version": "...", "document_hash": "..." }]
  p_ip TEXT,
  p_user_agent TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  candidate UUID := auth.uid();
  profile_id UUID;
BEGIN
  IF candidate IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_acceptances)
  LOOP
    INSERT INTO candidate_terms_acceptances
      (candidate_id, document_type, partner_id, version, document_hash, ip_address, user_agent)
    VALUES (
      candidate,
      item ->> 'document_type',
      NULLIF(item ->> 'partner_id', '')::uuid,
      item ->> 'version',
      item ->> 'document_hash',
      p_ip,
      p_user_agent
    )
    ON CONFLICT (
      candidate_id, document_type,
      COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid),
      version
    ) DO NOTHING;
  END LOOP;

  -- Same transaction as the inserts above — either both happen or neither
  -- does. Only proceeds once NOTHING is outstanding for this candidate at
  -- all (reuses the exact same check the middleware gate itself calls), so
  -- a partial acceptance (e.g. platform terms only, programme terms still
  -- pending) never queues provisioning early.
  IF NOT candidate_has_outstanding_terms() THEN
    SELECT id INTO profile_id FROM portfolio_profiles WHERE user_id = candidate LIMIT 1;

    IF profile_id IS NOT NULL THEN
      UPDATE portfolio_profiles
      SET provisioning_status = 'pending'
      WHERE id = profile_id
        AND provisioning_status = 'not_required'
        AND EXISTS (
          SELECT 1
          FROM candidate_entitlements ce
          JOIN partners p ON p.id = ce.granted_by_partner
          WHERE ce.candidate_id = profile_id
            AND ce.revoked_at IS NULL
            AND p.community_enabled = true
        );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_candidate_acceptance(JSONB, TEXT, TEXT) TO authenticated;

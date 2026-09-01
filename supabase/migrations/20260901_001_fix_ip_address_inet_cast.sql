-- Migration: fix record_candidate_acceptance() to cast ip_address to inet
--
-- Live error found while testing: "column ip_address is of type inet but
-- expression is of type text". candidate_terms_acceptances.ip_address is
-- typed `inet` in the actual database — this migration's own earlier files
-- (20260824_001) guessed TEXT, which never matched. Same schema-drift
-- situation CLAUDE.md warns about: the Dashboard-created column was the
-- more correct type, the migration file's assumption was wrong.
--
-- Only the ip_address cast changes; the rest of the function body is
-- identical to 20260831_002's version (plain insert-only, no provisioning
-- enqueue). NULLIF guards an empty string the same way it already does for
-- partner_id, since '' is not a valid inet literal either.

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

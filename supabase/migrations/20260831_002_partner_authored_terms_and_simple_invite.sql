-- Migration: partner-authored programme terms (optional per invite) +
-- retire the Circle API provisioning apparatus in favour of a plain
-- partner-supplied invite link.
--
-- Context: programme terms are no longer super-admin-published on a
-- partner's behalf — a partner authors their own (manual text or a PDF
-- upload) on their own dashboard, and can have none at all. Whether a
-- SPECIFIC invite requires the partner's terms is now a per-invite choice
-- (a checkbox on the provision form, default checked), not an all-or-
-- nothing partner-level gate — hence requires_programme_terms living on
-- partner_tokens/candidate_entitlements rather than being inferred purely
-- from "does an active document exist."
--
-- Community access no longer goes through any provider API — a partner
-- just pastes their own invite link once (partners.community_url, already
-- added in 20260831_001, repurposed here as the one remaining community
-- field) and it's shown directly to the candidate. Everything else
-- provisioning-related from 20260824_001 is retired below.

-- ── 1. Per-invite programme-terms opt-out ──────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partner_tokens' AND column_name = 'requires_programme_terms') THEN
    ALTER TABLE partner_tokens ADD COLUMN requires_programme_terms BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_entitlements' AND column_name = 'requires_programme_terms') THEN
    ALTER TABLE candidate_entitlements ADD COLUMN requires_programme_terms BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- ── 2. terms_documents: support a file (PDF) source, not just typed text ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_documents' AND column_name = 'source_storage_path') THEN
    ALTER TABLE terms_documents ADD COLUMN source_storage_path TEXT; -- storage path when this version is a file upload, else null
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_documents' AND column_name = 'source_file_type') THEN
    ALTER TABLE terms_documents ADD COLUMN source_file_type TEXT; -- e.g. 'pdf'; null when body-based
  END IF;
END $$;

-- body was NOT NULL (text-only model) — a file-sourced version has no body,
-- its hash is computed over the file's bytes instead. Enforce "exactly one
-- source" via CHECK rather than leaving both nullable with no guarantee.
ALTER TABLE terms_documents ALTER COLUMN body DROP NOT NULL;

ALTER TABLE terms_documents DROP CONSTRAINT IF EXISTS terms_documents_one_source;
ALTER TABLE terms_documents ADD CONSTRAINT terms_documents_one_source CHECK (
  (body IS NOT NULL AND source_storage_path IS NULL) OR
  (body IS NULL AND source_storage_path IS NOT NULL)
);

-- Private bucket for partner-uploaded PDF terms, signed-URL access only —
-- same pattern as the existing simulation-submissions bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-terms-documents', 'partner-terms-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Retire the Circle API provisioning columns ───────────────────────────
-- partners.community_url is KEPT — it's now the one remaining community
-- field, repurposed as the partner's own invite link (was already exactly
-- this in spirit: "the actual link candidates are sent to").
ALTER TABLE partners DROP COLUMN IF EXISTS community_provider;
ALTER TABLE partners DROP COLUMN IF EXISTS community_identifier;
ALTER TABLE partners DROP COLUMN IF EXISTS community_space_id;
ALTER TABLE partners DROP COLUMN IF EXISTS community_credential_ref;
ALTER TABLE partners DROP COLUMN IF EXISTS community_credential_last4;
ALTER TABLE partners DROP COLUMN IF EXISTS community_enabled;

ALTER TABLE portfolio_profiles DROP COLUMN IF EXISTS community_member_id;
ALTER TABLE portfolio_profiles DROP COLUMN IF EXISTS provisioning_status;
ALTER TABLE portfolio_profiles DROP COLUMN IF EXISTS provisioning_attempts;
ALTER TABLE portfolio_profiles DROP COLUMN IF EXISTS last_provisioning_attempt_at;

-- ── 4. candidate_has_outstanding_terms(): respect requires_programme_terms ──
-- Was: every partner that has ANY active entitlement for this candidate is
-- checked against that partner's active programme document, unconditionally.
-- Now: a partner is only checked if at least one of the candidate's
-- entitlement rows from them has requires_programme_terms = true — a
-- candidate can hold multiple rows per partner (one per discipline, per
-- candidate_entitlements' own unique constraint), so this is an OR across
-- them, not read off a single row.
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

  -- Only partners where at least one entitlement row requires their terms.
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

-- ── 5. record_candidate_acceptance(): drop the provisioning-enqueue block ──
-- 20260830_001 made this function also flip portfolio_profiles.
-- provisioning_status → 'pending' atomically with the acceptance write.
-- That column is dropped above (section 3) — there is no more provisioning
-- status to set. Reverting to the plain insert-only shape from 20260824_001.
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
      p_ip,
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

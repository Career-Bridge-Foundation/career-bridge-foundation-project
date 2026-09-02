-- Migration: community provisioning configuration support (Spec 19.3)
--
-- 20260824_001 added community_provider / community_identifier /
-- community_space_id / community_credential_ref / community_enabled on
-- `partners`, but nothing has ever written to them — no UI existed. This
-- adds the two columns the admin config UI needs that weren't there yet:
--
--  - community_url: the actual link candidates are sent to (e.g.
--    https://careerbridge.circle.so). Kept separate from the original
--    community_identifier (a bare slug/name) since a full URL is simpler to
--    both store and render as a link, and works regardless of provider —
--    community_identifier is left in place, unused, rather than repurposed.
--  - community_credential_last4: the last 4 characters of the admin token,
--    stored in plaintext specifically so the UI can show "configured,
--    ending in ****1234" without ever decrypting the real credential just
--    to render a masked hint. community_credential_ref itself now holds an
--    AES-256-GCM ciphertext (iv:authTag:ciphertext, base64), never the
--    plaintext token — see lib/partners/communityCredential.ts.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_url') THEN
    ALTER TABLE partners ADD COLUMN community_url TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'community_credential_last4') THEN
    ALTER TABLE partners ADD COLUMN community_credential_last4 TEXT;
  END IF;
END $$;

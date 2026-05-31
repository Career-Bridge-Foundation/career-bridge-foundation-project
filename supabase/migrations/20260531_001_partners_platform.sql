-- Migration: Partners platform foundation
-- Phase 1 of Spec 5.1 — database tables for multi-tenant partner architecture.
--
-- Architecture (Path A2):
--   `partners` is a new top-level entity representing partner organisations
--   (Career Bridge Foundation, Join Momentum, future partners). Existing
--   `coaches` table is preserved as-is, with a new nullable `partner_id`
--   FK so coaches can be linked to a parent partner organisation when the
--   sub-coach-within-partner feature is built later.
--
--   `credential_issuances` keeps its existing `coach_id` column and gains
--   a new `partner_id` column — credentials can be attributed to both a
--   partner (which organisation issued the platform access) and a coach
--   (which mentor within the partner guided the candidate).
--
-- Creates: partners, candidate_entitlements, partner_tokens, partner_api_keys.
-- Extends: portfolio_profiles (provisioned_by_partner), coaches (partner_id),
--          credential_issuances (partner_id).
-- Seeds: Career Bridge Foundation, Join Momentum as approved partners.
-- Backfills: existing portfolio_profiles linked to Career Bridge Foundation.

-- ===== PARTNERS =====

CREATE TABLE IF NOT EXISTS partners (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                            TEXT NOT NULL,
  slug                            TEXT NOT NULL UNIQUE,
  legal_entity_name               TEXT,
  contact_email                   TEXT NOT NULL,
  contact_name                    TEXT,
  status                          TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'suspended')),
  is_first_party                  BOOLEAN NOT NULL DEFAULT FALSE,
  logo_url                        TEXT,
  primary_color                   TEXT,
  secondary_color                 TEXT,
  custom_domain                   TEXT,
  email_sender_domain             TEXT,
  email_sender_name               TEXT,
  seat_rate_cents                 INTEGER,
  volume_commitment_seats         INTEGER,
  volume_commitment_rate_cents    INTEGER,
  approved_at                     TIMESTAMPTZ,
  approved_by                     UUID REFERENCES auth.users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_custom_domain ON partners(custom_domain) WHERE custom_domain IS NOT NULL;

-- ===== CANDIDATE_ENTITLEMENTS =====

CREATE TABLE IF NOT EXISTS candidate_entitlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID NOT NULL REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  discipline          TEXT NOT NULL,
  granted_by_partner  UUID NOT NULL REFERENCES partners(id),
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES auth.users(id),
  revoked_reason      TEXT,
  UNIQUE(candidate_id, discipline, granted_by_partner)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_candidate ON candidate_entitlements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_partner ON candidate_entitlements(granted_by_partner);
CREATE INDEX IF NOT EXISTS idx_entitlements_active ON candidate_entitlements(candidate_id, discipline) WHERE revoked_at IS NULL;

-- ===== PARTNER_TOKENS =====

CREATE TABLE IF NOT EXISTS partner_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          UUID NOT NULL REFERENCES partners(id),
  token_hash          TEXT NOT NULL UNIQUE,
  candidate_email     TEXT NOT NULL,
  candidate_name      TEXT,
  disciplines         TEXT[] NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  redeemed_at         TIMESTAMPTZ,
  redeemed_by         UUID REFERENCES portfolio_profiles(id),
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tokens_partner ON partner_tokens(partner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON partner_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_unredeemed ON partner_tokens(token_hash) WHERE redeemed_at IS NULL AND revoked_at IS NULL;

-- ===== PARTNER_API_KEYS =====

CREATE TABLE IF NOT EXISTS partner_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  name            TEXT,
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON partner_api_keys(key_prefix);

-- ===== EXTEND EXISTING TABLES =====

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfolio_profiles' AND column_name = 'provisioned_by_partner'
  ) THEN
    ALTER TABLE portfolio_profiles
      ADD COLUMN provisioned_by_partner UUID REFERENCES partners(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credential_issuances' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE credential_issuances
      ADD COLUMN partner_id UUID REFERENCES partners(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaches' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE coaches
      ADD COLUMN partner_id UUID REFERENCES partners(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coaches_partner ON coaches(partner_id) WHERE partner_id IS NOT NULL;

-- ===== RLS =====

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;

-- Helper note: policies use dual-source role lookup (JWT app_metadata first,
-- fall back to user_roles table). This matches getCurrentUserRole() in
-- lib/auth/permissions.ts. The OR clause covers both code paths so neither
-- placement of role data causes silent rejection.

-- Partners: staff (admin/super_admin/content_developer) read and write
CREATE POLICY partners_staff_all ON partners FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'super_admin', 'content_developer')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'content_developer')
    )
  );

-- Candidate entitlements: candidate reads own, admin/super_admin read+write all
CREATE POLICY entitlements_candidate_read ON candidate_entitlements FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM portfolio_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY entitlements_admin_all ON candidate_entitlements FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Partner tokens: admin/super_admin only
CREATE POLICY tokens_admin_all ON partner_tokens FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('admin', 'super_admin')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- API keys: super_admin only (most sensitive — these grant partner API access)
CREATE POLICY api_keys_super_admin_all ON partner_api_keys FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'super_admin'
    )
  );

-- ===== SEED PARTNERS =====
-- TODO before applying: replace <VICTOR_EMAIL_HERE> with Victor's actual email.

INSERT INTO partners (
  name, slug, legal_entity_name, contact_email, contact_name,
  status, approved_at, custom_domain, primary_color
)
VALUES (
  'Career Bridge Foundation',
  'career-bridge-foundation',
  'Career Bridge Foundation CIC',
  'growwithvictorsonde@gmail.com',
  'Victor Sonde',
  'approved',
  now(),
  'learn.careerbridgefoundation.com',
  '#003359'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO partners (
  name, slug, legal_entity_name, contact_email, contact_name,
  status, approved_at, custom_domain
)
VALUES (
  'Join Momentum',
  'join-momentum',
  'Join Momentum Inc, Delaware',
  'growwithvictorsonde@gmail.com',
  'Victor Sonde',
  'approved',
  now(),
  'learn.joinmomentum.com'
)
ON CONFLICT (slug) DO NOTHING;

-- ===== BACKFILL =====
-- Link existing candidates to Career Bridge as their originating partner.
-- Only sets where currently NULL; idempotent.

UPDATE portfolio_profiles
SET provisioned_by_partner = (SELECT id FROM partners WHERE slug = 'career-bridge-foundation')
WHERE provisioned_by_partner IS NULL;

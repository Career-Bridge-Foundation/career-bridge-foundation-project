-- Migration: partners branding columns + public branding view (Spec 05.4)
--
-- Reconciles migration history with production: the `subdomain` and
-- `logo_url_icon` / `logo_url_on_light` / `logo_url_on_dark` columns on
-- `partners`, and the `partner_public_branding` view, were added directly
-- via the Supabase Dashboard SQL editor while building the white-label
-- feature (see CLAUDE.md "Database-touching code" — dashboard SQL isn't
-- always mirrored in migration files). lib/partners/branding.ts,
-- app/admin/partners/page.tsx, app/admin/partners/_subdomain-editor.tsx, and
-- app/partner/branding/page.tsx all already depend on these existing.
--
-- IMPORTANT: this file is inferred from application code usage, NOT
-- exported from the live schema. Diff it against the actual Dashboard
-- schema before applying — see CLAUDE.md "Production schema is the source
-- of truth." Written idempotent (IF NOT EXISTS guards) so it's safe to run
-- even if some/all of these objects already exist.

-- ===== PARTNERS: branding columns =====

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE partners ADD COLUMN subdomain TEXT UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'logo_url_icon'
  ) THEN
    ALTER TABLE partners ADD COLUMN logo_url_icon TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'logo_url_on_light'
  ) THEN
    ALTER TABLE partners ADD COLUMN logo_url_on_light TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'logo_url_on_dark'
  ) THEN
    ALTER TABLE partners ADD COLUMN logo_url_on_dark TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_partners_subdomain ON partners(subdomain) WHERE subdomain IS NOT NULL;

-- ===== PUBLIC BRANDING VIEW =====
--
-- Anon-readable, presentation-only projection of approved partners, keyed by
-- subdomain. Exposes ONLY the columns branding resolution needs — no
-- contact info, no billing fields, no email-sender config. `partners` itself
-- stays staff-only via RLS (partners_staff_all in 20260531_001); this view's
-- owner privileges (not the querying role's) are what let the anon role read
-- through it — the standard Supabase pattern for a filtered public subset of
-- an otherwise-restricted table. See lib/partners/branding.ts.

CREATE OR REPLACE VIEW partner_public_branding AS
SELECT
  id,
  name,
  subdomain,
  logo_url_icon,
  logo_url_on_light,
  logo_url_on_dark,
  primary_color,
  secondary_color
FROM partners
WHERE status = 'approved'
  AND subdomain IS NOT NULL;

GRANT SELECT ON partner_public_branding TO anon;

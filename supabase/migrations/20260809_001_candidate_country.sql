-- Migration: candidate country capture
--
-- Partner console adds a required country field when provisioning a
-- candidate (app/partner/_mint-form.tsx). Set by the partner, who already
-- vetted the candidate during admission — never inferred from IP and never
-- self-reported by the candidate — specifically so a candidate cannot
-- misreport their location to reach a cheaper regional price later.
--
-- Stored on partner_tokens at mint time, copied to portfolio_profiles at
-- redemption (app/api/redeem/route.ts), mirroring how candidate_name already
-- flows through the same two tables. Pricing logic itself is intentionally
-- NOT wired to this column yet — capture only, per current direction.
--
-- ISO 3166-1 alpha-2, e.g. 'GB', 'NG', 'US'. Written idempotent
-- (IF NOT EXISTS guards), matching this repo's migration convention.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_tokens' AND column_name = 'country'
  ) THEN
    ALTER TABLE partner_tokens ADD COLUMN country TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portfolio_profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE portfolio_profiles ADD COLUMN country TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_profiles_country ON portfolio_profiles(country) WHERE country IS NOT NULL;

-- Ad-hoc backfill — run manually via Supabase Dashboard SQL Editor.
-- NOT a migration; production schema is the source of truth (see CLAUDE.md).
--
-- Bug: portfolio_profiles.provisioned_by_partner was never set for
-- candidates invited via the partner_tokens -> /api/redeem flow (only
-- candidate_entitlements.granted_by_partner was). checkout-link, packs,
-- and activate all gate on provisioned_by_partner, so those candidates
-- were wrongly blocked with "candidate is not provisioned by a partner;
-- purchase is unavailable". Fixed going forward in app/api/redeem/route.ts;
-- this backfills everyone already stuck in that state.
--
-- Picks one partner per candidate (earliest granted entitlement) in case a
-- candidate somehow holds entitlements from more than one partner —
-- provisioned_by_partner is a single column, it can't hold more than one.

-- 1. Preview affected rows before writing.
SELECT
  pp.id AS portfolio_id,
  pp.user_id,
  ce.granted_by_partner AS partner_id_to_set
FROM portfolio_profiles pp
JOIN LATERAL (
  SELECT granted_by_partner
  FROM candidate_entitlements
  WHERE candidate_id = pp.id
  ORDER BY granted_at ASC
  LIMIT 1
) ce ON true
WHERE pp.provisioned_by_partner IS NULL;

-- 2. Apply the backfill.
-- A correlated subquery in SET, not LATERAL — Postgres won't let a
-- LATERAL subquery in UPDATE...FROM reference the update target (pp).
UPDATE portfolio_profiles pp
SET provisioned_by_partner = (
  SELECT ce.granted_by_partner
  FROM candidate_entitlements ce
  WHERE ce.candidate_id = pp.id
  ORDER BY ce.granted_at ASC
  LIMIT 1
)
WHERE pp.provisioned_by_partner IS NULL
  AND EXISTS (
    SELECT 1 FROM candidate_entitlements ce WHERE ce.candidate_id = pp.id
  );

-- 3. Confirm no eligible candidate is left stranded.
SELECT count(*) AS still_null_with_entitlement
FROM portfolio_profiles pp
WHERE pp.provisioned_by_partner IS NULL
  AND EXISTS (SELECT 1 FROM candidate_entitlements ce WHERE ce.candidate_id = pp.id);

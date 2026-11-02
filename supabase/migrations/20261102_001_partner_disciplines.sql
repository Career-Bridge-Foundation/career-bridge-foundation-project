-- Spec 20 — Partner & Candidate Discipline Access.
--
-- The discipline RANGE a partner may grant. Zero active rows for a partner
-- means UNRESTRICTED (every grantable discipline) — so existing partners are
-- unaffected until a super-admin assigns at least one. Soft-revoke
-- convention (revoked_at), matching candidate_entitlements; re-granting a
-- revoked discipline reactivates the same row via the UNIQUE upsert.
--
-- `discipline` is the slug (matches candidate_entitlements.discipline and
-- simulations.discipline), not the display name.
--
-- No RLS policies: every read/write goes through service-role API routes
-- (super-admin for writes; partner/mentor routes read it server-side).

CREATE TABLE IF NOT EXISTS partner_disciplines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  discipline   TEXT NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by   UUID REFERENCES auth.users(id),
  revoked_at   TIMESTAMPTZ,
  revoked_by   UUID REFERENCES auth.users(id),
  UNIQUE (partner_id, discipline)
);

CREATE INDEX IF NOT EXISTS idx_partner_disciplines_active
  ON partner_disciplines(partner_id) WHERE revoked_at IS NULL;

ALTER TABLE partner_disciplines ENABLE ROW LEVEL SECURITY;

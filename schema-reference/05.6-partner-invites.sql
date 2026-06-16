-- ============================================================
-- SCHEMA REFERENCE — Spec 05.6 (partner sub-admin invites)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the Supabase
-- Dashboard SQL Editor (production is source of truth — see CLAUDE.md).
-- Recorded here verbatim so the repo reflects production reality.
--
-- Apply: run one statement at a time (CREATE TABLE -> indexes -> RLS+policy)
-- to isolate failures, then SELECT to confirm the columns landed.
--
-- Backs the partner Team > Sub-admins tab: a partner-admin invites a peer by
-- email; the invitee accepts and is elevated to a flat 'partner' role linked
-- to the inviter's partner_id (via the shared elevateUser + assertNoCrossOrgHijack).
--
-- Conventions / deliberate choices:
--   * OPAQUE token (random, sha256-hashed into token_hash) — NOT the candidate
--     JWT. The row carries invited_email / partner_id / expires_at, so JWT
--     claims would be redundant.
--   * status holds ONLY 'pending' | 'accepted'. 'expired' is DERIVED at read
--     time (expires_at <= now()) — never stored, so there is NO sweep/cron.
--   * invited_by / accepted_by -> SET NULL: attribution only; deleting the
--     inviter/accepter must not block, the row survives with null attribution.
--   * partner_id -> (default RESTRICT): block accidental partner deletion while
--     invites exist.
--   * RLS partner-scoped SELECT is DEFENSE-IN-DEPTH; the scoped service-role
--     endpoints (requirePartner + ctx.partnerId) are the primary gate.
--   * revoke is POST-MVP (Spec 05.6) — no revoked_at column this slice.
-- ============================================================


CREATE TABLE public.partner_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid NOT NULL REFERENCES public.partners(id),
  invited_email text NOT NULL,
  invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash    text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted')),
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz,
  accepted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_invites_partner ON public.partner_invites(partner_id);
CREATE INDEX idx_partner_invites_pending ON public.partner_invites(partner_id) WHERE status = 'pending';

ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

-- A partner-admin may read their own org's invites (defense-in-depth).
CREATE POLICY partner_invites_partner_select ON public.partner_invites
  FOR SELECT USING (
    partner_id IN (
      SELECT partner_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

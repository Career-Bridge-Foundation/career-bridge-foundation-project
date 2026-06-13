-- ============================================================
-- SCHEMA REFERENCE — Spec 05.9 (partner candidate detail)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the Supabase
-- Dashboard SQL Editor (production is source of truth — see CLAUDE.md).
-- Recorded here verbatim so the repo reflects production reality.
--
-- Applied: 2026-06-13 (Dashboard), run as separate statements
-- (CREATE TABLE, then indexes, then RLS) to isolate failures.
-- ============================================================

-- partner_candidate_access_log — audit trail for partner admin views of
-- candidate detail (raw submission access). Service-role writes only.
--
-- viewer_id is a PLAIN uuid (the partner admin's auth.users.id) with NO FK to
-- auth.users: an audit log must outlive the users it references — a FK would
-- default to ON DELETE RESTRICT and block deleting an auth user who has log
-- rows. It is always populated from the authenticated ctx.userId; viewer_email
-- is denormalized so the log stays readable if the user is later removed.

CREATE TABLE public.partner_candidate_access_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES public.partners(id),
  viewer_id    uuid NOT NULL,
  viewer_email text,
  candidate_id uuid NOT NULL REFERENCES public.portfolio_profiles(id),
  viewed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcal_partner   ON public.partner_candidate_access_log(partner_id, viewed_at DESC);
CREATE INDEX idx_pcal_candidate ON public.partner_candidate_access_log(candidate_id, viewed_at DESC);

-- RLS on with NO policies → locked to the service-role client (bypasses RLS).
-- Internal audit log; never client-readable.
ALTER TABLE public.partner_candidate_access_log ENABLE ROW LEVEL SECURITY;

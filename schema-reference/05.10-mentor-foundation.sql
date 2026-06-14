-- ============================================================
-- SCHEMA REFERENCE — Spec 05.10 (mentor foundation)
-- ============================================================
-- NOT EXECUTED BY ANY MIGRATION TOOL. Applied manually via the Supabase
-- Dashboard SQL Editor (production is source of truth — see CLAUDE.md).
-- Recorded here verbatim so the repo reflects production reality.
--
-- Applied: 2026-06-14 (Dashboard), run one statement at a time
-- (CREATE TABLE -> indexes -> RLS+policy) per table, to isolate failures.
--
-- Both tables back the Mentor Portal: mentor_candidates assigns a mentor to
-- specific candidates (feeds getPartnerCandidateProgress's candidateUserIds
-- subset); mentor_disciplines grants a mentor preview access to a discipline's
-- gated content (a la candidate_entitlements, but NON-seat-consuming).
--
-- Conventions:
--   * revoked_at IS NULL = active (mirrors candidate_entitlements).
--   * Writes go through service-role endpoints scoped in code (requirePartner /
--     requireMentor + ctx ids). The RLS self-select policies below are
--     DEFENSE-IN-DEPTH (a mentor reading their own rows directly), NOT the
--     primary gate — the scoped server endpoints are.
--   * FK ON DELETE behaviour:
--       - mentor_user_id / candidate_user_id -> CASCADE: the assignment/grant is
--         meaningless once the user is gone, so it vanishes with them.
--       - assigned_by / granted_by -> SET NULL: attribution only; deleting the
--         admin who assigned must NOT be blocked, and the row should survive
--         with null attribution.
--       - partner_id -> (default RESTRICT): partners are not deleted casually;
--         block accidental deletion of a partner that still has mentor rows.
-- ============================================================


-- ─── mentor_candidates ──────────────────────────────────────
-- mentor <-> candidate assignment. candidate_user_id = auth.users.id
-- (= portfolio_profiles.user_id) so it feeds the primitive's candidateUserIds.

CREATE TABLE public.mentor_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id        uuid NOT NULL REFERENCES public.partners(id),
  assigned_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  UNIQUE (mentor_user_id, candidate_user_id)
);

CREATE INDEX idx_mentor_candidates_mentor  ON public.mentor_candidates(mentor_user_id);
CREATE INDEX idx_mentor_candidates_partner ON public.mentor_candidates(partner_id);
CREATE INDEX idx_mentor_candidates_active  ON public.mentor_candidates(mentor_user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.mentor_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY mentor_candidates_self_select ON public.mentor_candidates
  FOR SELECT USING (mentor_user_id = auth.uid());


-- ─── mentor_disciplines ─────────────────────────────────────
-- Admin/partner grants a mentor preview access to a discipline's gated content.
-- NON-seat-consuming (unlike candidate_entitlements). revoked_at IS NULL = active.

CREATE TABLE public.mentor_disciplines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline      text NOT NULL,
  partner_id      uuid NOT NULL REFERENCES public.partners(id),
  granted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  UNIQUE (mentor_user_id, discipline, partner_id)
);

CREATE INDEX idx_mentor_disciplines_mentor  ON public.mentor_disciplines(mentor_user_id);
CREATE INDEX idx_mentor_disciplines_partner ON public.mentor_disciplines(partner_id);
CREATE INDEX idx_mentor_disciplines_active  ON public.mentor_disciplines(mentor_user_id, discipline) WHERE revoked_at IS NULL;

ALTER TABLE public.mentor_disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY mentor_disciplines_self_select ON public.mentor_disciplines
  FOR SELECT USING (mentor_user_id = auth.uid());

-- Migration: fix over-broad grant on partner_candidate_acceptance_status
--
-- 20260824_001 granted SELECT on this view directly to the `authenticated`
-- role, with no row-level restriction — any authenticated user (any
-- candidate, any OTHER partner's own staff) could read every partner's
-- candidates' acceptance status via Supabase's auto-generated REST API for
-- the view. Nothing in the app read this view at the time, but the grant
-- itself was live and wrong the moment it applied — Spec 19 explicitly
-- wants this "scoped to that partner's own roster," not merely "status
-- only." Revoke it here.
--
-- Access is now exclusively through GET /api/partner/candidates/acceptance-status,
-- which reads the view with the service-role client and filters explicitly
-- by the authenticated partner's own ctx.partnerId — the same pattern every
-- other partner-scoped read in this codebase already uses (see e.g.
-- lib/partners/candidateDetail.ts).

REVOKE SELECT ON partner_candidate_acceptance_status FROM authenticated;

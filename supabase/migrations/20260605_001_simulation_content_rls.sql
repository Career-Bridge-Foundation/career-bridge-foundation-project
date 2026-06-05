-- ============================================================
-- Simulation content IP protection via entitlement-gated RLS
-- ============================================================
-- Protects simulation content (brief_full, brief_short, sim_role,
-- description, video_transcript, video_url, and all simulation_prompts)
-- so that only candidates with a matching, non-revoked entitlement can
-- read a simulation's rows. Admin/reviewer tooling reads via the service
-- role and bypasses RLS, so it is unaffected.
--
-- Applied to production 2026-06-05. Ordering matters: the gating policies
-- were ADDED FIRST (additive, no access change while the permissive
-- policies still OR'd in), verified against an entitled test candidate,
-- THEN the permissive policies were dropped. Reproduce in the same order.
-- ============================================================

-- 1. Entitlement-gated SELECT policies (additive) --------------

create policy "entitled_candidate_read_simulations"
on simulations for select
using (
  discipline in (
    select e.discipline
    from candidate_entitlements e
    join portfolio_profiles p on p.id = e.candidate_id
    where p.user_id = auth.uid()
      and e.revoked_at is null
  )
);

create policy "entitled_candidate_read_prompts"
on simulation_prompts for select
using (
  simulation_id in (
    select s.id
    from simulations s
    where s.discipline in (
      select e.discipline
      from candidate_entitlements e
      join portfolio_profiles p on p.id = e.candidate_id
      where p.user_id = auth.uid()
        and e.revoked_at is null
    )
  )
);

-- 2. Drop the permissive SELECT policies (only after step 1
--    is verified working for an entitled candidate) -----------

drop policy "Allow public read" on simulations;
drop policy "public_select" on simulations;
drop policy "public can read published simulations" on simulations;
drop policy "allow_select_all" on simulation_prompts;
drop policy "public_select_prompts" on simulation_prompts;

-- Retained (not dropped): admin_write, "admins read all simulations"
-- on simulations; admin_write_prompts on simulation_prompts.
-- These are is_admin()-gated and required for the CMS/admin tooling.

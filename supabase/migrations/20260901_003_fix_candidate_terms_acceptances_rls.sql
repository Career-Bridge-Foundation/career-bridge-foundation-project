-- Migration: fix candidate_terms_acceptances' own RLS policies — same
-- wrong-assumption bug as 20260901_002, just missed there.
--
-- Both policies compared candidate_id = auth.uid() directly. Confirmed (again)
-- that candidate_id is actually portfolio_profiles.id, not auth.users.id — the
-- INSERT policy is exactly what just blocked every real acceptance attempt
-- with "new row violates row-level security policy," even after
-- record_candidate_acceptance() itself was fixed to insert the correct id.
-- The SELECT policy has the identical latent bug (not yet hit by anything in
-- the app, since every current read goes through the service-role client,
-- but fixed here too rather than left broken for whenever something reads
-- this table under a candidate's own session).

DROP POLICY IF EXISTS candidate_terms_acceptances_own_read ON candidate_terms_acceptances;
CREATE POLICY candidate_terms_acceptances_own_read ON candidate_terms_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portfolio_profiles
      WHERE portfolio_profiles.id = candidate_terms_acceptances.candidate_id
        AND portfolio_profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS candidate_terms_acceptances_own_insert ON candidate_terms_acceptances;
CREATE POLICY candidate_terms_acceptances_own_insert ON candidate_terms_acceptances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolio_profiles
      WHERE portfolio_profiles.id = candidate_terms_acceptances.candidate_id
        AND portfolio_profiles.user_id = auth.uid()
    )
  );

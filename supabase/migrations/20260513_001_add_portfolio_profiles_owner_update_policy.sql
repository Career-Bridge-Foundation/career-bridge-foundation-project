-- Adds an UPDATE RLS policy on portfolio_profiles allowing authenticated
-- users to update their own row. Required by /api/portfolio/edit, which
-- runs as the user's session (not service role) so RLS is enforced.
--
-- Idempotent: the policy may already exist in production from earlier
-- ad-hoc work, so we guard with a pg_policies check.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_profiles'
    AND policyname = 'portfolio_profiles_owner_update'
  ) THEN
    CREATE POLICY "portfolio_profiles_owner_update"
      ON portfolio_profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

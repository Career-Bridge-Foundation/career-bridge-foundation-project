-- ── Activity log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS simulation_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid REFERENCES simulations(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated_metadata', 'updated_content', 'deleted')),
  diff jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_simulation_id ON simulation_activity(simulation_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON simulation_activity(created_at DESC);

-- Service role bypasses RLS so the admin API can insert freely.
-- Public cannot read activity logs.
ALTER TABLE simulation_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_activity" ON simulation_activity
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Update is_admin() to use Supabase Auth email ──────────────────────────────
-- auth.email() returns the authenticated user's email from the JWT,
-- which is more reliable than reading raw JWT claims manually.

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM admins WHERE email = auth.email()
  );
$$;

-- ── Seed admin emails from env (run manually after deploying) ─────────────────
-- INSERT INTO admins (email)
-- VALUES ('jobsimulatorai@gmail.com')
-- ON CONFLICT (email) DO NOTHING;

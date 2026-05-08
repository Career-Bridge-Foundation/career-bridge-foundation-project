-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Create simulations table
CREATE TABLE IF NOT EXISTS simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text,
  company text,
  industry text,
  type text,
  difficulty text CHECK (difficulty IN ('Foundation','Practitioner','Advanced')),
  time text,
  description text,
  display_order int,
  sim_role text,
  brief_short text,
  brief_full text,
  video_transcript text,
  time_remaining int[],
  prompts jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index on display_order
CREATE INDEX IF NOT EXISTS idx_simulations_display_order ON simulations(display_order);

-- SECURITY: function to check admin via JWT email
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM admins WHERE email = (current_setting('request.jwt.claims', true))::json->> 'email');
$$;

-- Enable RLS
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

-- Allow SELECT to public (read open)
CREATE POLICY "public_select" ON simulations
  FOR SELECT
  USING (true);

-- Restrict INSERT/UPDATE/DELETE to admins
CREATE POLICY "admin_write" ON simulations
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Trigger to update updated_at on change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON simulations;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON simulations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

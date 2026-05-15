-- ══════════════════════════════════════════════════════════════
-- RBAC: user_roles, reviewer_disciplines, simulation cert fields,
--       updated is_admin(), JWT access token hook
-- ══════════════════════════════════════════════════════════════

-- ── 1. user_roles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  role        TEXT NOT NULL CHECK (role IN ('candidate', 'admin', 'super_admin', 'reviewer')),
  permissions JSONB NOT NULL DEFAULT '{}',
  granted_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own role row (service role bypasses for admin ops)
CREATE POLICY "user_roles_own_select"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- ── 2. reviewer_disciplines ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviewer_disciplines (
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline  TEXT NOT NULL,
  PRIMARY KEY (reviewer_id, discipline)
);

ALTER TABLE public.reviewer_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviewer_disciplines_own_select"
  ON public.reviewer_disciplines FOR SELECT
  USING (reviewer_id = auth.uid());

-- ── 3. Extend simulations: discipline + certification ──────────
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS discipline   TEXT,
  ADD COLUMN IF NOT EXISTS cert_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (cert_status IN ('pending', 'certified', 'rejected')),
  ADD COLUMN IF NOT EXISTS cert_notes   TEXT,
  ADD COLUMN IF NOT EXISTS certified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ;

-- ── 4. Update is_admin() to check user_roles instead of admins ─
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- ── 5. Migrate existing admins table → user_roles ──────────────
INSERT INTO public.user_roles (user_id, email, role, permissions)
SELECT
  u.id,
  u.email,
  'admin',
  '{"canManageSimulations":true,"canManageUsers":false,"canViewAnalytics":true,"canExportData":true}'::jsonb
FROM auth.users u
WHERE u.email IN (SELECT email FROM public.admins)
ON CONFLICT (user_id) DO NOTHING;

-- ── 6. JWT custom access token hook ───────────────────────────
-- Embeds user_role + permissions into every JWT app_metadata.
--
-- IMPORTANT: after running this migration, go to:
--   Supabase Dashboard → Authentication → Hooks
--   Enable "Custom Access Token" → set to: public.custom_access_token_hook
--
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims  jsonb;
  v_role  text;
  v_perms jsonb;
BEGIN
  claims := event->'claims';

  SELECT role, permissions
    INTO v_role, v_perms
    FROM public.user_roles
   WHERE user_id = (event->>'user_id')::uuid;

  claims := jsonb_set(
    claims,
    '{app_metadata}',
    COALESCE(claims->'app_metadata', '{}') || jsonb_build_object(
      'user_role',   COALESCE(v_role,  'candidate'),
      'permissions', COALESCE(v_perms, '{}'::jsonb)
    )
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

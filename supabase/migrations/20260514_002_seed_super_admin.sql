-- ══════════════════════════════════════════════════════════════
-- Seed the initial super_admin.
-- Run AFTER migration 20260514_001_rbac.sql and AFTER the
-- super admin account exists in Supabase Auth.
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.user_roles (user_id, email, role, permissions, granted_by)
SELECT
  u.id,
  u.email,
  'super_admin',
  '{"canManageSimulations":true,"canManageUsers":true,"canViewAnalytics":true,"canExportData":true}'::jsonb,
  u.id
FROM auth.users u
WHERE u.email = 'jobsimulatorai@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET role        = 'super_admin',
      permissions = '{"canManageSimulations":true,"canManageUsers":true,"canViewAnalytics":true,"canExportData":true}'::jsonb;

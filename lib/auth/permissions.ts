import { createClient, supabaseServer } from '@/lib/supabase/server'

export type UserRole = 'candidate' | 'admin' | 'super_admin' | 'reviewer'

export type AdminPermissions = {
  canManageSimulations: boolean
  canManageUsers: boolean
  canViewAnalytics: boolean
  canExportData: boolean
}

export type RoleContext = {
  userId: string
  email: string
  role: UserRole
  permissions: AdminPermissions
}

const SUPER_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageSimulations: true,
  canManageUsers: true,
  canViewAnalytics: true,
  canExportData: true,
}

const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  canManageSimulations: true,
  canManageUsers: false,
  canViewAnalytics: true,
  canExportData: false,
}

export async function getCurrentUserRole(): Promise<RoleContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fast path: role embedded in JWT via custom_access_token_hook
  const appMeta = (user.app_metadata ?? {}) as {
    user_role?: UserRole
    permissions?: AdminPermissions
  }

  if (appMeta.user_role) {
    const role = appMeta.user_role
    return {
      userId: user.id,
      email: user.email ?? '',
      role,
      permissions: role === 'super_admin'
        ? SUPER_ADMIN_PERMISSIONS
        : (appMeta.permissions ?? DEFAULT_ADMIN_PERMISSIONS),
    }
  }

  // Fallback: DB query for sessions that predate the JWT hook being enabled
  const { data } = await supabaseServer
    .from('user_roles')
    .select('role, permissions')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = ((data?.role as UserRole) ?? 'candidate')
  return {
    userId: user.id,
    email: user.email ?? '',
    role,
    permissions: role === 'super_admin'
      ? SUPER_ADMIN_PERMISSIONS
      : ((data?.permissions as AdminPermissions) ?? DEFAULT_ADMIN_PERMISSIONS),
  }
}

export async function requireAdmin(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || !['admin', 'super_admin'].includes(ctx.role)) {
    throw new Error('Forbidden')
  }
  return ctx
}

export async function requireSuperAdmin(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'super_admin') {
    throw new Error('Forbidden')
  }
  return ctx
}

export async function requireReviewer(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'reviewer') {
    throw new Error('Forbidden')
  }
  return ctx
}

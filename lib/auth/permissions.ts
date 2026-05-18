import { createClient, supabaseServer } from '@/lib/supabase/server'

export type UserRole = 'candidate' | 'admin' | 'super_admin' | 'reviewer' | 'content_developer'

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

const CONTENT_DEVELOPER_PERMISSIONS: AdminPermissions = {
  canManageSimulations: true,
  canManageUsers: false,
  canViewAnalytics: false,
  canExportData: false,
}

export async function getCurrentUserRole(): Promise<RoleContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const appMeta = (user.app_metadata ?? {}) as {
    user_role?: UserRole
    permissions?: AdminPermissions
  }

  if (appMeta.user_role) {
    const role = appMeta.user_role
    const defaultPerms =
      role === 'super_admin'       ? SUPER_ADMIN_PERMISSIONS :
      role === 'content_developer' ? CONTENT_DEVELOPER_PERMISSIONS :
                                     DEFAULT_ADMIN_PERMISSIONS
    return {
      userId: user.id,
      email: user.email ?? '',
      role,
      permissions: role === 'super_admin' ? SUPER_ADMIN_PERMISSIONS : (appMeta.permissions ?? defaultPerms),
    }
  }

  const { data } = await supabaseServer
    .from('user_roles')
    .select('role, permissions')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = ((data?.role as UserRole) ?? 'candidate')
  const defaultPerms =
    role === 'super_admin'       ? SUPER_ADMIN_PERMISSIONS :
    role === 'content_developer' ? CONTENT_DEVELOPER_PERMISSIONS :
                                   DEFAULT_ADMIN_PERMISSIONS
  return {
    userId: user.id,
    email: user.email ?? '',
    role,
    permissions: role === 'super_admin'
      ? SUPER_ADMIN_PERMISSIONS
      : ((data?.permissions as AdminPermissions) ?? defaultPerms),
  }
}

/** Requires admin or super_admin. Content developers are NOT included. */
export async function requireAdmin(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || !['admin', 'super_admin'].includes(ctx.role)) {
    throw new Error('Forbidden')
  }
  return ctx
}

/** Requires super_admin only. */
export async function requireSuperAdmin(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'super_admin') {
    throw new Error('Forbidden')
  }
  return ctx
}

/** Requires reviewer only. */
export async function requireReviewer(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'reviewer') {
    throw new Error('Forbidden')
  }
  return ctx
}

/** Requires any staff role that has access to the admin panel. */
export async function requireStaff(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || !['admin', 'super_admin', 'content_developer'].includes(ctx.role)) {
    throw new Error('Forbidden')
  }
  return ctx
}

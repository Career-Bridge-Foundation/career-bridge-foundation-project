import { createClient, supabaseServer } from '@/lib/supabase/server'

export type UserRole = 'candidate' | 'admin' | 'super_admin' | 'reviewer' | 'content_developer' | 'partner' | 'mentor'

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
  partnerId: string | null
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

/** No admin permissions. The restrictive default for any role whose access
 *  does not come from these flags (candidate, reviewer, partner, mentor). */
const NO_PERMISSIONS: AdminPermissions = {
  canManageSimulations: false,
  canManageUsers: false,
  canViewAnalytics: false,
  canExportData: false,
}

/** Default permission set for a role when no explicit permissions are stored.
 *  Unlisted roles get NO admin permissions — their access comes from dedicated
 *  paths, not these booleans. (Previously every unlisted role silently inherited
 *  DEFAULT_ADMIN_PERMISSIONS via fallthrough — a privilege leak.) */
function defaultPermissionsFor(role: UserRole): AdminPermissions {
  switch (role) {
    case 'super_admin':       return SUPER_ADMIN_PERMISSIONS
    case 'admin':             return DEFAULT_ADMIN_PERMISSIONS
    case 'content_developer': return CONTENT_DEVELOPER_PERMISSIONS
    default:                  return NO_PERMISSIONS
  }
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
    return {
      userId: user.id,
      email: user.email ?? '',
      role,
      permissions: role === 'super_admin' ? SUPER_ADMIN_PERMISSIONS : (appMeta.permissions ?? defaultPermissionsFor(role)),
      partnerId: (appMeta as { partner_id?: string }).partner_id ?? null,
    }
  }

  const { data } = await supabaseServer
    .from('user_roles')
    .select('role, permissions, partner_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = ((data?.role as UserRole) ?? 'candidate')
  return {
    userId: user.id,
    email: user.email ?? '',
    role,
    permissions: role === 'super_admin'
      ? SUPER_ADMIN_PERMISSIONS
      : ((data?.permissions as AdminPermissions) ?? defaultPermissionsFor(role)),
    partnerId: (data?.partner_id as string | null) ?? null,
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

/** Requires partner role with a linked partner org. */
export async function requirePartner(): Promise<RoleContext> {
  const ctx = await getCurrentUserRole()
  if (!ctx || ctx.role !== 'partner' || !ctx.partnerId) {
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

import { NextResponse } from 'next/server'
import { getCurrentUserRole } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const ctx = await getCurrentUserRole()
    if (!ctx || !['admin', 'super_admin', 'content_developer'].includes(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({
      role: ctx.role,
      permissions: ctx.permissions,
      userId: ctx.userId,
      email: ctx.email,
    })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

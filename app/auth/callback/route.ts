import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNextPath(nextValue: string | null): string {
  if (!nextValue) return '/'
  if (!nextValue.startsWith('/')) return '/'
  if (nextValue.startsWith('//')) return '/'
  return nextValue
}

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}

async function roleBasedRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  origin: string,
  explicitNext: string,
): Promise<string> {
  // If the caller supplied a real destination, honour it
  if (explicitNext !== '/') return `${origin}${explicitNext}`

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const role = roleRow?.role ?? 'candidate'
  if (role === 'reviewer') return `${origin}/reviewer`
  if (role === 'admin' || role === 'super_admin' || role === 'content_developer') {
    return `${origin}/admin`
  }
  return `${origin}/`
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const { searchParams } = request.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'email' | 'recovery' | 'signup' | null
  const next       = sanitizeNextPath(searchParams.get('next'))

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const dest = await roleBasedRedirect(supabase, data.user.id, origin, next)
      return NextResponse.redirect(dest)
    }
    const msg = error?.message ?? 'auth_error'
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`)
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.user) {
      const dest = await roleBasedRedirect(supabase, data.user.id, origin, next)
      return NextResponse.redirect(dest)
    }
    const msg = error?.message ?? 'auth_error'
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
}

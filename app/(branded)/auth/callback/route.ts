import { NextResponse, type NextRequest } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/auth/sanitizeNextPath'

function isProfileIncomplete(fullName: string | null | undefined): boolean {
  if (!fullName) return true
  const t = fullName.trim()
  return t === '' || t === 'Career Bridge Candidate'
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
  userId: string,
  origin: string,
  explicitNext: string,
): Promise<string> {
  // If the caller supplied a real destination, honour it
  if (explicitNext !== '/') return `${origin}${explicitNext}`

  // Service-role read: this runs immediately after exchangeCodeForSession/
  // verifyOtp in the same request, and a per-request cookie client can hit an
  // RLS/session-propagation timing gap right at that boundary. Role lookup is
  // a plain read keyed by the already-verified userId, so there's no reason
  // to route it through the user's own (just-minted) session at all.
  const { data: roleRow } = await supabaseServer
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const role = roleRow?.role ?? 'candidate'
  if (role === 'reviewer') return `${origin}/reviewer`
  if (role === 'partner') return `${origin}/partner`
  if (role === 'mentor') return `${origin}/mentor`
  if (role === 'admin' || role === 'super_admin' || role === 'content_developer') {
    return `${origin}/admin`
  }

  // Candidates: send incomplete profiles to onboarding before the dashboard
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()
  if (isProfileIncomplete(profile?.full_name)) {
    return `${origin}/account/profile?onboarding=1`
  }

  return `${origin}/`
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const { searchParams } = request.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'email' | 'recovery' | 'signup' | 'magiclink' | 'email_change' | null
  const next       = sanitizeNextPath(searchParams.get('next'))

  const supabase = await createClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const dest = await roleBasedRedirect(data.user.id, origin, next)
      return NextResponse.redirect(dest)
    }
    const msg = error?.message ?? 'auth_error'
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`)
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.user) {
      const dest = await roleBasedRedirect(data.user.id, origin, next)
      return NextResponse.redirect(dest)
    }
    const msg = error?.message ?? 'auth_error'
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
}

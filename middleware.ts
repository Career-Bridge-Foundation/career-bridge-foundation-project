import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not add code between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAdminPath    = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  const isAdminLogin   = pathname === '/admin/login'
  const isReviewerPath = pathname.startsWith('/reviewer') || pathname.startsWith('/api/reviewer')

  // ── Resolve role once (used by multiple guards below) ────────────────────
  let resolvedRole: string | null = null

  async function getRole(): Promise<string> {
    if (resolvedRole !== null) return resolvedRole
    const appMeta = (user?.app_metadata ?? {}) as { user_role?: string }
    if (appMeta.user_role) { resolvedRole = appMeta.user_role; return resolvedRole }
    if (!user) { resolvedRole = 'anonymous'; return resolvedRole }
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    resolvedRole = data?.role ?? 'candidate'
    return resolvedRole as string
  }

  // ── Home page guard ──────────────────────────────────────────────────────
  // Unauthenticated → /auth/login
  // Authenticated   → role-based dashboard
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    if (!user) {
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
    const role = await getRole()
    if (role === 'super_admin' || role === 'admin' || role === 'content_developer') {
      url.pathname = '/admin'
    } else if (role === 'reviewer') {
      url.pathname = '/reviewer'
    } else {
      url.pathname = '/simulations'
    }
    return NextResponse.redirect(url)
  }

  // ── Reviewer isolation ───────────────────────────────────────────────────
  // Reviewers must stay within /reviewer (and auth paths). Any other route
  // redirects them back to /reviewer.
  const isAuthPath = pathname.startsWith('/auth') || pathname.startsWith('/api/auth')
  const isPublicApiPath = pathname.startsWith('/api/') && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/reviewer')

  if (user && !isReviewerPath && !isAuthPath && !isAdminLogin && !isPublicApiPath) {
    const role = await getRole()
    if (role === 'reviewer') {
      const url = request.nextUrl.clone()
      url.pathname = '/reviewer'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // ── Admin / staff routes ─────────────────────────────────────────────────
  if (isAdminPath && !isAdminLogin) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    const userRole = await getRole()

    const isStaff =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'content_developer'

    if (!isStaff) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/simulations'
      return NextResponse.redirect(url)
    }
  }

  // ── Reviewer routes ──────────────────────────────────────────────────────
  if (isReviewerPath) {
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('next', '/reviewer')
      return NextResponse.redirect(url)
    }

    const userRole = await getRole()

    if (userRole !== 'reviewer') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/simulations'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
}

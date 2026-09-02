import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { subdomainFromHost, resolvePartnerBranding } from '@/lib/partners/branding'

const PARTNER_HEADERS = [
  'x-partner-id',
  'x-partner-name',
  'x-partner-logo-icon',
  'x-partner-logo-light',
  'x-partner-logo-dark',
  'x-partner-primary',
  'x-partner-secondary',
] as const

export async function middleware(request: NextRequest) {
  // ── Spec 05.4 Phase 1: host→partner branding (presentation-only) ──────────
  // Strip any client-supplied x-partner-* first (anti-spoof), then set fresh
  // values only when we positively resolve a partner from the subdomain.
  // This block must never redirect, throw, or affect access — branding ≠ auth.
  for (const h of PARTNER_HEADERS) request.headers.delete(h)

  const { pathname: _p } = request.nextUrl
  const skipBranding =
    _p.startsWith('/api') ||
    _p.startsWith('/admin') ||
    _p.startsWith('/reviewer') ||
    _p.startsWith('/_next')

  if (!skipBranding) {
    const subdomain = subdomainFromHost(request.headers.get('host'))

    // Portfolios are the candidate's own permanent, verified artefact —
    // never tied to a partner's subdomain, which can disappear if that
    // partner leaves. Redirect unconditionally on ANY detected subdomain,
    // even one that no longer resolves to an active partner below (an
    // orphaned subdomain must still redirect, not 404 or serve a stale
    // page) — this is the guarantee itself, not just a link-generation
    // convention; it holds regardless of how the request arrived (an old
    // bookmark, a shared link, a search result). subdomainFromHost() already
    // returns null for "app" itself (RESERVED_SUBDOMAINS), so this can't loop.
    if (subdomain && _p.startsWith('/portfolio')) {
      const canonicalBase = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://app.evidentize.io'
      const canonicalUrl = new URL(_p + request.nextUrl.search, canonicalBase)
      return NextResponse.redirect(canonicalUrl, 308)
    }

    if (subdomain) {
      const partner = await resolvePartnerBranding(subdomain) // null-safe, never throws
      if (partner) {
        request.headers.set('x-partner-id', partner.id)
        request.headers.set('x-partner-name', partner.name)
        if (partner.logo_url_icon)     request.headers.set('x-partner-logo-icon', partner.logo_url_icon)
        if (partner.logo_url_on_light) request.headers.set('x-partner-logo-light', partner.logo_url_on_light)
        if (partner.logo_url_on_dark)  request.headers.set('x-partner-logo-dark', partner.logo_url_on_dark)
        if (partner.primary_color)     request.headers.set('x-partner-primary', partner.primary_color)
        if (partner.secondary_color)   request.headers.set('x-partner-secondary', partner.secondary_color)
      }
    }
    // apex / unknown subdomain / lookup failure → no headers set → neutral.
  }
  // ──────────────────────────────────────────────────────────────────────────

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
  const isReviewerPath = pathname.startsWith('/reviewer') || pathname.startsWith('/api/reviewer')
  const isPartnerPath  = pathname.startsWith('/partner') || pathname.startsWith('/api/partner')

  // Redirect legacy admin/login to the unified auth login
  if (pathname === '/admin/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

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
  // Authenticated dashboard users landing on / are redirected to their own
  // dashboard. Candidates and unauthenticated visitors are allowed through.
  if (pathname === '/') {
    if (user) {
      const role = await getRole()
      const dashboardRedirects: Record<string, string> = {
        reviewer:          '/reviewer',
        partner:           '/partner',
        mentor:            '/mentor',
        admin:             '/admin',
        super_admin:       '/admin',
        content_developer: '/admin/simulations',
      }
      const dest = dashboardRedirects[role]
      if (dest) {
        const url = request.nextUrl.clone()
        url.pathname = dest
        return NextResponse.redirect(url)
      }
    }
    return supabaseResponse
  }

  // ── Dashboard-only role isolation ────────────────────────────────────────
  // reviewer/partner/mentor/content_developer may only access their own
  // dashboard area, plus a small set of paths every role needs regardless
  // (sign-in/out, account settings, accepting a future invite). admin and
  // super_admin are exempt — they keep full site access (see below).
  // content_developer is scoped to /admin/simulations specifically, not all
  // of /admin — that's the only area their own sidebar nav ever shows them
  // (app/admin/_sidebar.tsx: Team/Partners/Settings are admin/super_admin-only).
  const isAuthPath = pathname.startsWith('/auth') || pathname.startsWith('/api/auth')
  const isAccountPath = pathname.startsWith('/account') || pathname.startsWith('/api/account')
  const isAcceptInvitePath =
    pathname.startsWith('/accept-invite') || pathname.startsWith('/api/partner/invites/accept')
  const isAcceptTermsPath =
    pathname.startsWith('/accept-terms') ||
    pathname.startsWith('/api/candidate/accept') ||
    pathname.startsWith('/api/candidate/acceptance-status')
  const isSharedPath = isAuthPath || isAccountPath || isAcceptInvitePath || isAcceptTermsPath
  // Deliberately narrower than isSharedPath: /account is NOT exempt from the
  // candidate acceptance gate below. Spec 19 requires "no catalogue, practice
  // OR PROFILE data from any route" until both documents are accepted — the
  // broader isSharedPath (built for the dashboard-isolation guard above,
  // where /account legitimately needs to stay reachable for every role) would
  // have let a gated candidate keep reading/editing /account/profile.
  const isAcceptanceGateExempt = isAuthPath || isAcceptInvitePath || isAcceptTermsPath

  const DASHBOARD_ONLY_PATHS: Record<string, string> = {
    reviewer: '/reviewer',
    partner: '/partner',
    mentor: '/mentor',
    content_developer: '/admin/simulations',
  }

  if (user && !isSharedPath) {
    const role = await getRole()
    const ownDashboard = DASHBOARD_ONLY_PATHS[role]
    if (ownDashboard && !pathname.startsWith(ownDashboard) && !pathname.startsWith(`/api${ownDashboard}`)) {
      const url = request.nextUrl.clone()
      url.pathname = ownDashboard
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // ── Candidate acceptance gate (Spec 19) ──────────────────────────────────
  // An authenticated candidate with any outstanding document (platform terms,
  // or any partner's programme terms for a partner that has entitled them)
  // gets no catalogue, practice or profile data from any route until they
  // accept — enforced here, at the single choke point every request passes
  // through, not left to individual pages. candidate_has_outstanding_terms()
  // does the real check in one round trip; see that function's definition in
  // supabase/migrations/20260824_001_candidate_acceptance.sql.
  if (user && !isAcceptanceGateExempt) {
    const role = await getRole()
    if (role === 'candidate') {
      const { data: outstanding } = await supabase.rpc('candidate_has_outstanding_terms')
      if (outstanding) {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(JSON.stringify({ error: 'terms_not_accepted' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const url = request.nextUrl.clone()
        url.pathname = '/accept-terms'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  // ── Admin / staff routes ─────────────────────────────────────────────────
  // Defense in depth: every /admin and /api/admin path requires a staff role
  // (admin/super_admin/content_developer), enforced here at the edge so a
  // page or route handler that forgets its own requireXxx() check is still
  // blocked, rather than relying solely on per-page/per-route discipline.
  // content_developer's further restriction to /admin/simulations only is
  // already handled by DASHBOARD_ONLY_PATHS above — admin/super_admin get
  // full access within this block (full site access, by design).
  const STAFF_ROLES = ['admin', 'super_admin', 'content_developer']
  if (isAdminPath) {
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const userRole = await getRole()

    if (!STAFF_ROLES.includes(userRole)) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/'
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
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // ── Partner routes ───────────────────────────────────────────────────────
  // Spec 18 acceptance criterion 7: /partner/* must be gated in middleware,
  // not only by the page-level requirePartner() check.
  if (isPartnerPath) {
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('next', '/partner')
      return NextResponse.redirect(url)
    }

    const userRole = await getRole()

    if (userRole !== 'partner') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/'
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
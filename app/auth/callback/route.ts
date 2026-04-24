import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNextPath(nextValue: string | null): string {
  if (!nextValue) return '/'
  if (!nextValue.startsWith('/')) return '/'
  if (nextValue.startsWith('//')) return '/'
  return nextValue
}

function getOrigin(request: NextRequest): string {
  // On Vercel (and other proxies) the real host is in x-forwarded-host
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = sanitizeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNextPath(nextValue: string | null): string {
  if (!nextValue) return '/'
  if (!nextValue.startsWith('/')) return '/'
  if (nextValue.startsWith('//')) return '/'
  return nextValue
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
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

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCandidateHomeSubdomain } from '@/lib/partners/candidateHomeSubdomain'

export const runtime = 'nodejs'

/**
 * GET /api/account/home-subdomain — the logged-in candidate's own partner
 * subdomain, if any. Used ONLY by the site Header (a client component, so
 * it can't resolve this server-side directly the way app/portfolio/[slug]/
 * page.tsx does), and only on pages that force the browser onto the
 * canonical app.evidentize.io host regardless of which subdomain the
 * candidate started on — see lib/partners/candidateHomeSubdomain.ts.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ subdomain: null })

  const subdomain = await getCandidateHomeSubdomain(user.id)
  return NextResponse.json({ subdomain })
}

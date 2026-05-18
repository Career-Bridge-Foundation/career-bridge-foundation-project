import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile }, { data: portfolioProfile }] = await Promise.all([
    supabaseServer.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabaseServer.from('portfolio_profiles')
      .select('slug, headline, bio, location, linkedin_url, external_links, is_public')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    portfolio_slug: portfolioProfile?.slug ?? null,
    headline: portfolioProfile?.headline ?? null,
    bio: portfolioProfile?.bio ?? null,
    location: portfolioProfile?.location ?? null,
    linkedin_url: portfolioProfile?.linkedin_url ?? null,
    external_links: portfolioProfile?.external_links ?? [],
    is_public: portfolioProfile?.is_public ?? false,
  })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { full_name, headline, bio, location, linkedin_url, external_links, is_public } = body

  const updates: Promise<{ error: unknown }>[] = []

  if (full_name !== undefined) {
    updates.push(
      supabaseServer.from('profiles').update({ full_name }).eq('id', user.id) as unknown as Promise<{ error: unknown }>
    )
  }

  const portfolioUpdate: Record<string, unknown> = {}
  if (headline !== undefined)       portfolioUpdate.headline       = headline
  if (bio !== undefined)            portfolioUpdate.bio            = bio
  if (location !== undefined)       portfolioUpdate.location       = location
  if (linkedin_url !== undefined)   portfolioUpdate.linkedin_url   = linkedin_url
  if (external_links !== undefined) portfolioUpdate.external_links = external_links
  if (is_public !== undefined)      portfolioUpdate.is_public      = is_public

  if (Object.keys(portfolioUpdate).length > 0) {
    updates.push(
      supabaseServer
        .from('portfolio_profiles')
        .update(portfolioUpdate)
        .eq('user_id', user.id) as unknown as Promise<{ error: unknown }>
    )
  }

  await Promise.all(updates)

  return NextResponse.json({ ok: true })
}

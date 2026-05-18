import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ProfilePageContent } from './ProfilePageContent'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: portfolioProfile }] = await Promise.all([
    supabaseServer.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabaseServer.from('portfolio_profiles')
      .select('slug, headline, bio, location, linkedin_url, external_links, is_public')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return (
    <ProfilePageContent
      initial={{
        email: user.email ?? '',
        full_name: profile?.full_name ?? user.user_metadata?.full_name ?? '',
        avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        portfolio_slug: portfolioProfile?.slug ?? null,
        headline: portfolioProfile?.headline ?? '',
        bio: portfolioProfile?.bio ?? '',
        location: portfolioProfile?.location ?? '',
        linkedin_url: portfolioProfile?.linkedin_url ?? '',
        external_links: Array.isArray(portfolioProfile?.external_links) ? portfolioProfile.external_links : [],
      }}
    />
  )
}

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
      .select('id, slug, headline, bio, location, linkedin_url, external_links, is_public')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Persistent community link — shown whenever any partner entitling this
  // candidate has set one (partners.community_url), no status/provisioning
  // concept involved. A partner without one simply produces no card.
  let community: { partnerName: string | null; communityUrl: string } | null = null
  if (portfolioProfile?.id) {
    const { data: ents } = await supabaseServer
      .from('candidate_entitlements')
      .select('granted_by_partner')
      .eq('candidate_id', portfolioProfile.id)
      .is('revoked_at', null)
    const partnerIds = [...new Set((ents ?? []).map((e) => e.granted_by_partner as string))]
    if (partnerIds.length) {
      const { data: partner } = await supabaseServer
        .from('partners')
        .select('name, community_url')
        .in('id', partnerIds)
        .not('community_url', 'is', null)
        .maybeSingle()
      if (partner?.community_url) {
        community = {
          partnerName: (partner.name as string | null) ?? null,
          communityUrl: partner.community_url as string,
        }
      }
    }
  }

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
        community,
      }}
    />
  )
}

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
      .select('id, slug, headline, bio, location, linkedin_url, external_links, is_public, provisioning_status')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Spec 19.3: surface a persistent community link/status — nothing at all
  // when provisioning_status is 'not_required' (no community configured for
  // this candidate's partner), matching "a partner without it simply has no
  // provisioning step."
  let community: { status: 'pending' | 'provisioned' | 'failed'; partnerName: string | null; communityUrl: string | null } | null = null
  const provisioningStatus = portfolioProfile?.provisioning_status as string | undefined
  if (portfolioProfile?.id && (provisioningStatus === 'pending' || provisioningStatus === 'provisioned' || provisioningStatus === 'failed')) {
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
        .eq('community_enabled', true)
        .maybeSingle()
      if (partner) {
        community = {
          status: provisioningStatus as 'pending' | 'provisioned' | 'failed',
          partnerName: (partner.name as string | null) ?? null,
          communityUrl: (partner.community_url as string | null) ?? null,
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

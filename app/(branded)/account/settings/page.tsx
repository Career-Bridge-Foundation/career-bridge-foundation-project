import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/supabase/server'
import { AccountSettingsContent } from './AccountSettingsContent'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: portfolioProfile } = await supabaseServer
    .from('portfolio_profiles')
    .select('is_public')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <AccountSettingsContent
      initial={{
        email: user.email ?? '',
        portfolioPublic: portfolioProfile?.is_public ?? false,
        hasPortfolio: !!portfolioProfile,
      }}
    />
  )
}

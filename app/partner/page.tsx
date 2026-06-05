import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { MintForm } from './_mint-form'

export const dynamic = 'force-dynamic'

export default async function PartnerPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner')
  }

  // Resolve the partner org for a welcome line.
  const { data: partner } = await supabaseServer
    .from('partners')
    .select('name')
    .eq('id', ctx.partnerId)
    .maybeSingle()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 13, color: '#4DC5D2', marginBottom: 8 }}>
        Partner Portal
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: '#003359', marginBottom: 12 }}>
        {partner?.name ?? 'Partner'}
      </h1>
      <p style={{ color: '#475569', lineHeight: 1.6 }}>
        Welcome to your partner area. Candidate management and seat provisioning will appear here.
      </p>
        <MintForm />
    </main>
  )
}

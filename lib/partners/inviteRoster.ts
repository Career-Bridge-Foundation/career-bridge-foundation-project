import { supabaseServer } from '@/lib/supabase/server'

export type PartnerInviteStatus = 'pending' | 'accepted' | 'expired'

export type PartnerInvite = {
  id: string
  email: string
  status: PartnerInviteStatus
  invitedBy: string | null
  createdAt: string | null
  expiresAt: string | null
  acceptedAt: string | null
}

/**
 * The partner's sub-admin invites, scoped strictly to `partnerId`. The caller
 * supplies the authenticated partner's own id (requirePartner()).
 *
 * `status` is stored as only 'pending'/'accepted' (see
 * schema-reference/05.6-partner-invites.sql). 'expired' is DERIVED here at read
 * time — a pending invite past its expires_at reads as 'expired'. No sweep/cron.
 */
export async function getPartnerInvites(partnerId: string): Promise<PartnerInvite[]> {
  const { data, error } = await supabaseServer
    .from('partner_invites')
    .select('id, invited_email, status, invited_by, created_at, expires_at, accepted_at')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const now = Date.now()
  return (data ?? []).map((r) => {
    const stored = r.status as 'pending' | 'accepted'
    const status: PartnerInviteStatus =
      stored === 'pending' &&
      r.expires_at &&
      new Date(r.expires_at as string).getTime() <= now
        ? 'expired'
        : stored
    return {
      id: r.id as string,
      email: r.invited_email as string,
      status,
      invitedBy: (r.invited_by as string | null) ?? null,
      createdAt: (r.created_at as string | null) ?? null,
      expiresAt: (r.expires_at as string | null) ?? null,
      acceptedAt: (r.accepted_at as string | null) ?? null,
    }
  })
}

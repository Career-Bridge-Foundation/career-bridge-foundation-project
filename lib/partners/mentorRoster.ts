import { supabaseServer } from '@/lib/supabase/server'
import { getPartnerCandidates } from '@/lib/partners/candidateProgress'

export type MentorAssignedCandidate = {
  userId: string
  fullName: string | null
  email: string | null
}

export type PartnerMentor = {
  userId: string
  email: string | null
  grantedAt: string | null // user_roles.created_at
  disciplines: string[] // ACTIVE mentor_disciplines for this partner
  candidates: MentorAssignedCandidate[] // ACTIVE mentor_candidates for this partner
}

/**
 * The partner's mentors with their ACTIVE discipline grants and ACTIVE
 * candidate assignments, scoped strictly to `partnerId`. The caller supplies
 * the authenticated partner's own id (requirePartner()); never user input.
 *
 * Candidate names/emails come from the scoped roster primitive
 * (getPartnerCandidates) — same partner scope, no extra enrichment. A candidate
 * assigned then later entitlement-revoked won't be in the roster; it still
 * renders, by id, with a null name (graceful, not an error).
 */
export async function getPartnerMentors(partnerId: string): Promise<PartnerMentor[]> {
  // 1. Mentors of this partner. email is on the row (mentor-users writes it).
  const { data: mentors, error: mErr } = await supabaseServer
    .from('user_roles')
    .select('user_id, email, created_at')
    .eq('role', 'mentor')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
  if (mErr) throw mErr
  if (!mentors?.length) return []

  const mentorIds = mentors.map((m) => m.user_id as string)

  // 2. Active discipline grants, grouped by mentor.
  const { data: discs, error: dErr } = await supabaseServer
    .from('mentor_disciplines')
    .select('mentor_user_id, discipline')
    .in('mentor_user_id', mentorIds)
    .eq('partner_id', partnerId)
    .is('revoked_at', null)
  if (dErr) throw dErr
  const discByMentor = new Map<string, string[]>()
  for (const d of discs ?? []) {
    const arr = discByMentor.get(d.mentor_user_id as string) ?? []
    arr.push(d.discipline as string)
    discByMentor.set(d.mentor_user_id as string, arr)
  }

  // 3. Active assignments, grouped by mentor.
  const { data: asgs, error: aErr } = await supabaseServer
    .from('mentor_candidates')
    .select('mentor_user_id, candidate_user_id')
    .in('mentor_user_id', mentorIds)
    .eq('partner_id', partnerId)
    .is('revoked_at', null)
  if (aErr) throw aErr
  const candIdsByMentor = new Map<string, string[]>()
  for (const a of asgs ?? []) {
    const arr = candIdsByMentor.get(a.mentor_user_id as string) ?? []
    arr.push(a.candidate_user_id as string)
    candIdsByMentor.set(a.mentor_user_id as string, arr)
  }

  // 4. Names/emails for assigned candidates via the scoped roster primitive.
  const roster = await getPartnerCandidates(partnerId)
  const byUserId = new Map(roster.map((r) => [r.userId, r]))

  return mentors.map((m) => {
    const uid = m.user_id as string
    const candidates: MentorAssignedCandidate[] = (candIdsByMentor.get(uid) ?? []).map((cid) => {
      const r = byUserId.get(cid)
      return { userId: cid, fullName: r?.fullName ?? null, email: r?.email ?? null }
    })
    return {
      userId: uid,
      email: (m.email as string | null) ?? null,
      grantedAt: (m.created_at as string | null) ?? null,
      disciplines: discByMentor.get(uid) ?? [],
      candidates,
    }
  })
}

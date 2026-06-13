import { supabaseServer } from '@/lib/supabase/server'

export type PartnerUsageCandidate = { candidateId: string; disciplines: string[]; firstRedeemedAt: string }
export type PartnerUsage = {
  seatsConsumed: number
  seatsCommitted: number | null
  seatsRemaining: number | null
  candidates: PartnerUsageCandidate[]
  seatsThisPeriod?: number
  period?: { start: string; end: string }
}

/**
 * Seat metering for a partner. 1 seat = 1 unique candidate (non-revoked grants),
 * counted once regardless of disciplines. Consumption is all-time / permanent.
 * Trusts partnerId (caller supplies the authenticated partner's id).
 *
 * Optional `period` adds seatsThisPeriod (candidates whose FIRST redemption falls
 * in [start, end)) for periodic invoicing. Throws on DB error (caller maps to 500).
 */
export async function getPartnerUsage(
  partnerId: string,
  period?: { start: Date; end: Date } | null,
): Promise<PartnerUsage> {
  const { data, error } = await supabaseServer
    .from('candidate_entitlements')
    .select('candidate_id, discipline, granted_at')
    .eq('granted_by_partner', partnerId)
    .is('revoked_at', null)
  if (error) throw new Error(`entitlements query failed: ${error.message}`)

  const { data: partnerRow, error: partnerErr } = await supabaseServer
    .from('partners')
    .select('volume_commitment_seats')
    .eq('id', partnerId)
    .maybeSingle()
  if (partnerErr) throw new Error(`partner lookup failed: ${partnerErr.message}`)

  const rows = data ?? []

  // Collapse to distinct candidates. Each candidate = one seat. Track disciplines
  // and the earliest grant (first-redemption) for backing detail + period logic.
  const byCandidate = new Map<string, PartnerUsageCandidate>()
  for (const row of rows) {
    const id = row.candidate_id as string
    const discipline = row.discipline as string
    const grantedAt = row.granted_at as string
    const existing = byCandidate.get(id)
    if (!existing) {
      byCandidate.set(id, { candidateId: id, disciplines: [discipline], firstRedeemedAt: grantedAt })
    } else {
      if (!existing.disciplines.includes(discipline)) existing.disciplines.push(discipline)
      if (grantedAt < existing.firstRedeemedAt) existing.firstRedeemedAt = grantedAt
    }
  }

  const candidates = Array.from(byCandidate.values())
  const seatsConsumed = candidates.length
  const seatsCommitted = (partnerRow?.volume_commitment_seats as number | null) ?? null
  const seatsRemaining = seatsCommitted === null ? null : seatsCommitted - seatsConsumed

  const usage: PartnerUsage = { seatsConsumed, seatsCommitted, seatsRemaining, candidates }

  if (period) {
    usage.seatsThisPeriod = candidates.filter((c) => {
      const first = new Date(c.firstRedeemedAt).getTime()
      return first >= period.start.getTime() && first < period.end.getTime()
    }).length
    usage.period = { start: period.start.toISOString(), end: period.end.toISOString() }
  }

  return usage
}

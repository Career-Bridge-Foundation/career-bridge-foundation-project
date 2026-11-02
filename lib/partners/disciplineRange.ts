import { supabaseServer } from '@/lib/supabase/server'
import { grantableDisciplines } from '@/lib/disciplines-data'
import type { Discipline } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Partner discipline range (Spec 20).
//
// A super-admin can restrict a partner to a subset of the grantable
// disciplines (partner_disciplines). ZERO active rows ⇒ UNRESTRICTED — the
// partner can grant every grantable discipline, which is how every partner
// behaved before this table existed.
//
// Every grant path (invite minting, redemption, mentor preview grants,
// candidate discipline edits) must check against this — never against
// grantableDisciplines directly.
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerDisciplineRange = {
  restricted: boolean
  /** Slugs the partner may grant — always a subset of grantableDisciplines. */
  slugs: string[]
}

const GRANTABLE_SLUGS = new Set(grantableDisciplines.map((d) => d.slug))

/** Trusts the partnerId it is given — callers resolve it from the session. */
export async function getPartnerDisciplineRange(partnerId: string): Promise<PartnerDisciplineRange> {
  const { data, error } = await supabaseServer
    .from('partner_disciplines')
    .select('discipline')
    .eq('partner_id', partnerId)
    .is('revoked_at', null)
  if (error) throw error

  const assigned = (data ?? []).map((r) => r.discipline as string)
  if (assigned.length === 0) {
    return { restricted: false, slugs: [...GRANTABLE_SLUGS] }
  }
  // A discipline later made non-grantable drops out of the range here rather
  // than staying grantable through a stale row.
  return { restricted: true, slugs: assigned.filter((s) => GRANTABLE_SLUGS.has(s)) }
}

export function isInRange(range: PartnerDisciplineRange, slug: string): boolean {
  return range.slugs.includes(slug)
}

/** The grantable Discipline records inside a range, in catalogue order. */
export function disciplinesInRange(range: PartnerDisciplineRange): Discipline[] {
  return grantableDisciplines.filter((d) => range.slugs.includes(d.slug))
}

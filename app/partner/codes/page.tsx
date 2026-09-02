import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/auth/permissions'
import { getAllocationState, CeilingError } from '@/lib/entitlement/ceiling'
import { supabaseServer } from '@/lib/supabase/server'
import { effectiveCodeStatus } from '@/lib/entitlement/codeStatus'
import { formatCodeForDisplay } from '@/lib/entitlement/sponsorCode'
import { CodesView, type CodeRow } from './_codes-view'

export const dynamic = 'force-dynamic'

export default async function PartnerCodesPage() {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    redirect('/auth/login?next=/partner/codes')
  }

  let allocation = null
  let allocationError: string | null = null
  try {
    allocation = await getAllocationState(ctx.partnerId!)
  } catch (err) {
    if (err instanceof CeilingError && err.code === 'no_active_allocation') {
      allocationError = 'No active allocation — contact Evidentize to set up your credit ceiling before minting codes.'
    } else {
      allocationError = 'Could not load your allocation. Please refresh.'
    }
  }

  let codes: CodeRow[] = []
  try {
    const { data } = await supabaseServer
      .from('sponsor_codes')
      .select('id, code, label, batch_id, prefix, credits_per_redemption, max_redemptions, redemptions_used, cohort_id, expires_at, created_at, revoked_at, note, status')
      .eq('partner_id', ctx.partnerId!)
      .order('created_at', { ascending: false })

    codes = (data ?? []).map((row) => {
      const status = effectiveCodeStatus(row as { status: 'active' | 'exhausted' | 'revoked'; expires_at: string })
      const reservedRemaining =
        ((row.max_redemptions as number) - (row.redemptions_used as number)) * (row.credits_per_redemption as number)
      return {
        id:                     row.id as string,
        code:                   row.code as string,
        display_code:           row.prefix ? formatCodeForDisplay(row.code as string, row.prefix as string) : (row.code as string).toUpperCase(),
        label:                  row.label as string | null,
        batch_id:               row.batch_id as string | null,
        credits_per_redemption: row.credits_per_redemption as number,
        max_redemptions:        row.max_redemptions as number,
        redemptions_used:       row.redemptions_used as number,
        cohort_id:              row.cohort_id as string | null,
        expires_at:             row.expires_at as string,
        created_at:             row.created_at as string,
        revoked_at:             row.revoked_at as string | null,
        note:                   row.note as string | null,
        reserved_value:         (row.credits_per_redemption as number) * (row.max_redemptions as number),
        reserved_remaining:     status === 'active' ? reservedRemaining : 0,
        status,
      } satisfies CodeRow
    })
  } catch {
    // codes stays [] — the page still renders with mint form
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Assessment Credits</p>
        <h1 className="text-2xl font-bold text-navy">Sponsor codes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Mint codes to give candidates access to assessed simulations — a shared code for a cohort briefing, or unique codes for one-to-one distribution.
        </p>
      </header>

      {allocationError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {allocationError}
        </div>
      ) : (
        <CodesView allocation={allocation!} initialCodes={codes} />
      )}
    </div>
  )
}

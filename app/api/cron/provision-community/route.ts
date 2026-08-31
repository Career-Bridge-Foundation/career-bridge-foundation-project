import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/cron/provision-community — Vercel Cron target (see vercel.json).
 * Vercel attaches `Authorization: Bearer $CRON_SECRET` to its own scheduled
 * requests; without CRON_SECRET set, this route is otherwise a public,
 * unauthenticated GET anyone could hit, so the check below is required, not
 * optional.
 *
 * Hobby-tier constraint: at most once per day (vercel.json's schedule).
 * A candidate who finishes accepting could wait up to 24h before this runs.
 * Fine for a small proof cohort, a real limitation if faster access matters
 * — revisit (Pro tier, or trigger off a Supabase webhook instead) once that
 * tradeoff is actually being felt.
 *
 * DRY RUN ONLY — no Circle credentials exist yet (Spec 19.3's real
 * integration is deferred), so this finds and logs candidates awaiting
 * provisioning without calling any provider API or touching their
 * provisioning_status. It exists so the scheduling/auth mechanism is
 * verified working now — swap runDryRun() for a real Circle call (with
 * retry/backoff, per Spec 19 decision 7) once the partner's community
 * credential is actually configured on /admin/partners → Community.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pending, error } = await supabaseServer
    .from('portfolio_profiles')
    .select('id, user_id, provisioning_attempts')
    .eq('provisioning_status', 'pending')

  if (error) {
    console.error('[cron/provision-community] query failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const candidates = pending ?? []
  console.log(`[cron/provision-community] dry run — found ${candidates.length} candidate(s) awaiting provisioning`)
  for (const c of candidates) {
    console.log(`[cron/provision-community]   candidate ${c.id} (attempts so far: ${c.provisioning_attempts ?? 0}) — no action taken (dry run)`)
  }

  return NextResponse.json({
    dry_run: true,
    found: candidates.length,
    candidate_ids: candidates.map((c) => c.id),
  })
}

import { NextResponse } from 'next/server'
import { createClient, supabaseServer } from '@/lib/supabase/server'
import { CURRENT_TERMS_VERSION } from '@/lib/entitlement/constants'

export const runtime = 'nodejs'

/**
 * POST /api/candidate/activate
 *
 * Activates an assessed simulation for the authenticated candidate by spending
 * one Assessment Credit. Delegates to the atomic activate_simulation() Postgres
 * RPC (spec-15-activate-rpc.sql) which performs the balance check, credit debit,
 * activation row insert, and terms acceptance in a single transaction.
 *
 * Body: {
 *   simulation_id              string (UUID)   required
 *   cohort_id                  string (UUID)   optional — if simulation is cohort-scoped
 *   immediate_performance_consent boolean      optional, default false
 * }
 *
 * Typed failure codes (branch on `code`, do not map to a generic error):
 *   simulation_not_found       — simulation_id does not exist
 *   practice_simulation        — Practice Trials are never activated
 *   insufficient_balance       — no credits; show sponsor code entry
 *   already_activated          — concurrent double-click; treat as success
 */
export async function POST(request: Request) {
  try {
    // 1. AUTH
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. PARSE BODY
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    }

    const { simulation_id, cohort_id, immediate_performance_consent } =
      body as {
        simulation_id?: unknown
        cohort_id?: unknown
        immediate_performance_consent?: unknown
      }

    if (typeof simulation_id !== 'string' || !simulation_id) {
      return NextResponse.json({ error: 'simulation_id required' }, { status: 400 })
    }

    // 3. RESOLVE PORTFOLIO + PARTNER
    const { data: portfolio } = await supabaseServer
      .from('portfolio_profiles')
      .select('id, provisioned_by_partner')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!portfolio) {
      return NextResponse.json({ error: 'portfolio not found' }, { status: 404 })
    }

    if (!portfolio.provisioned_by_partner) {
      return NextResponse.json(
        { error: 'no partner associated with this account' },
        { status: 422 },
      )
    }

    // 4. IP ADDRESS (for terms acceptance record)
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : null

    // 5. CALL ATOMIC RPC
    const { data: result, error: rpcError } = await supabaseServer.rpc(
      'activate_simulation',
      {
        p_candidate_id:      portfolio.id,
        p_simulation_id:     simulation_id,
        p_partner_id:        portfolio.provisioned_by_partner,
        p_terms_version:     CURRENT_TERMS_VERSION,
        p_cohort_id:         typeof cohort_id === 'string' ? cohort_id : null,
        p_ip_address:        ipAddress,
        p_immediate_consent: immediate_performance_consent === true,
      },
    )

    if (rpcError) {
      console.error('[candidate/activate] rpc error', rpcError)
      return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }

    const rpc = result as {
      success: boolean
      code?: string
      activation_id?: string
      credit_ledger_id?: string
      attempt_number?: number
    }

    // 6. BRANCH ON RESULT
    if (!rpc.success) {
      // already_activated on a concurrent double-click is safe to treat as success
      if (rpc.code === 'already_activated') {
        return NextResponse.json({ ok: true, already_activated: true })
      }

      const statusMap: Record<string, number> = {
        simulation_not_found: 404,
        practice_simulation:  422,
        insufficient_balance: 402,
      }

      return NextResponse.json(
        { error: rpc.code, code: rpc.code },
        { status: statusMap[rpc.code ?? ''] ?? 422 },
      )
    }

    return NextResponse.json({
      ok:               true,
      activation_id:   rpc.activation_id,
      attempt_number:  rpc.attempt_number,
    })
  } catch (err) {
    console.error('[candidate/activate] unexpected error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

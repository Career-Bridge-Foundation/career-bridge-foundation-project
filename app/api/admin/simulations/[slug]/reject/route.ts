import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/log-activity'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ctx = await requireAdmin()
    const { slug } = await params

    const { data: sim, error: fetchErr } = await supabaseServer
      .from('simulations')
      .select('id, status')
      .eq('slug', slug)
      .single()

    if (fetchErr || !sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sim.status !== 'pending_review') {
      return NextResponse.json({ error: 'Only pending_review simulations can be rejected' }, { status: 400 })
    }

    const { error } = await supabaseServer
      .from('simulations')
      .update({ status: 'draft' })
      .eq('slug', slug)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logActivity({
      simulationId: sim.id,
      userEmail: ctx.email,
      action: 'updated_metadata',
      diff: { status: { from: 'pending_review', to: 'draft' } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

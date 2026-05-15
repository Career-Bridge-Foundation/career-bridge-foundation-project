import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ctx = await requireReviewer()
    const { slug } = await params

    const body = await request.json()
    const { status, notes } = body as {
      status: 'certified' | 'rejected' | 'pending'
      notes?: string
    }

    if (!['certified', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'status must be certified, rejected, or pending' }, { status: 400 })
    }

    // Verify simulation exists and reviewer has discipline access
    const { data: sim, error: simErr } = await supabaseServer
      .from('simulations')
      .select('id, discipline')
      .eq('slug', slug)
      .maybeSingle()

    if (simErr) return NextResponse.json({ error: simErr.message }, { status: 500 })
    if (!sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: disciplineRows } = await supabaseServer
      .from('reviewer_disciplines')
      .select('discipline')
      .eq('reviewer_id', ctx.userId)

    const disciplines = (disciplineRows ?? []).map(d => d.discipline)
    if (sim.discipline && !disciplines.includes(sim.discipline)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {
      cert_status: status,
      cert_notes: notes ?? null,
    }

    if (status === 'certified' || status === 'rejected') {
      updates.certified_by = ctx.userId
      updates.certified_at = new Date().toISOString()
    } else {
      updates.certified_by = null
      updates.certified_at = null
    }

    const { error } = await supabaseServer
      .from('simulations')
      .update(updates)
      .eq('id', sim.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

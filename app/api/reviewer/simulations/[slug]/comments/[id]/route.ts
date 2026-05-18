import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ slug: string; id: string }> }

// DELETE /api/reviewer/simulations/[slug]/comments/[id]
// Only the comment's author may delete it
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireReviewer()
    const { id } = await params

    // Fetch the comment to verify ownership
    const { data: existing, error: fetchErr } = await supabaseServer
      .from('simulation_comments')
      .select('id, reviewer_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.reviewer_id !== ctx.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseServer
      .from('simulation_comments')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

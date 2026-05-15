import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ctx = await requireReviewer()
    const { slug } = await params

    // Get reviewer's disciplines
    const { data: disciplineRows } = await supabaseServer
      .from('reviewer_disciplines')
      .select('discipline')
      .eq('reviewer_id', ctx.userId)

    const disciplines = (disciplineRows ?? []).map(d => d.discipline)

    // Fetch simulation
    const { data: sim, error } = await supabaseServer
      .from('simulations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify discipline access
    if (sim.discipline && !disciplines.includes(sim.discipline)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch prompts from simulation_prompts table
    const { data: prompts } = await supabaseServer
      .from('simulation_prompts')
      .select('*')
      .eq('simulation_id', sim.id)
      .order('display_order', { ascending: true })

    // Fetch active rubric — keyed by simulation_slug, not simulation_id
    const { data: rubric } = await supabaseServer
      .from('rubrics')
      .select('id, version, system_prompt, model, max_score, is_active')
      .eq('simulation_slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    return NextResponse.json({ simulation: sim, prompts: prompts ?? [], rubric })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

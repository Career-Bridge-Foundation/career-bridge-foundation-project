import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

async function canAccess(reviewerId: string, sim: { discipline?: string | null; industry?: string | null; slug: string }): Promise<boolean> {
  if (!sim.discipline) return true

  const { data: disciplineRows } = await supabaseServer
    .from('reviewer_disciplines')
    .select('discipline')
    .eq('reviewer_id', reviewerId)
  if ((disciplineRows ?? []).some(d => d.discipline === sim.discipline)) return true

  const { data: assignmentRows } = await supabaseServer
    .from('reviewer_assignments')
    .select('discipline, industry, slug')
    .eq('reviewer_id', reviewerId)

  for (const a of assignmentRows ?? []) {
    if (a.discipline && a.discipline === sim.discipline) return true
    if (a.industry && a.industry === sim.industry) return true
    if (a.slug && a.slug === sim.slug) return true
  }

  return false
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ctx = await requireReviewer()
    const { slug } = await params

    const { data: sim, error } = await supabaseServer
      .from('simulations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!await canAccess(ctx.userId, sim)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: prompts } = await supabaseServer
      .from('simulation_prompts')
      .select('*')
      .eq('simulation_id', sim.id)
      .order('display_order', { ascending: true })

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

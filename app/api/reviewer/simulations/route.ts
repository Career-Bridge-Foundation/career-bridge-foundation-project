import { NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const ctx = await requireReviewer()

    // Get this reviewer's disciplines
    const { data: disciplineRows } = await supabaseServer
      .from('reviewer_disciplines')
      .select('discipline')
      .eq('reviewer_id', ctx.userId)

    const disciplines = (disciplineRows ?? []).map(d => d.discipline)

    // Fetch all simulations (use select * to avoid issues with missing columns)
    const { data: sims, error } = await supabaseServer
      .from('simulations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter in JS: show unclassified (no discipline) + matching discipline
    const filtered = (sims ?? []).filter(s => {
      if (!s.discipline) return true
      return disciplines.includes(s.discipline)
    })

    return NextResponse.json({ simulations: filtered, disciplines })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

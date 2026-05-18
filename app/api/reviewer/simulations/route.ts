import { NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const ctx = await requireReviewer()

    const { data: disciplineRows } = await supabaseServer
      .from('reviewer_disciplines')
      .select('discipline')
      .eq('reviewer_id', ctx.userId)
    const legacyDisciplines = new Set((disciplineRows ?? []).map(d => d.discipline))

    const { data: assignmentRows } = await supabaseServer
      .from('reviewer_assignments')
      .select('discipline, industry, slug')
      .eq('reviewer_id', ctx.userId)
    const assignedDisciplines = new Set((assignmentRows ?? []).map(a => a.discipline).filter(Boolean))
    const assignedIndustries  = new Set((assignmentRows ?? []).map(a => a.industry).filter(Boolean))
    const assignedSlugs       = new Set((assignmentRows ?? []).map(a => a.slug).filter(Boolean))

    const hasAnyAssignment =
      legacyDisciplines.size > 0 || assignedDisciplines.size > 0 ||
      assignedIndustries.size > 0 || assignedSlugs.size > 0

    const { data: sims, error } = await supabaseServer
      .from('simulations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const filtered = hasAnyAssignment
      ? (sims ?? []).filter(s => {
          if (s.discipline && (legacyDisciplines.has(s.discipline) || assignedDisciplines.has(s.discipline))) return true
          if (s.industry && assignedIndustries.has(s.industry)) return true
          if (assignedSlugs.has(s.slug)) return true
          return false
        })
      : []

    return NextResponse.json({ simulations: filtered, disciplines: [...legacyDisciplines] })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

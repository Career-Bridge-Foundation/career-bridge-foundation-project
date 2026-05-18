import { NextRequest, NextResponse } from 'next/server'
import { requireReviewer } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ slug: string }> }

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

// GET /api/reviewer/simulations/[slug]/comments
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireReviewer()
    const { slug } = await params

    const { data: sim, error: simErr } = await supabaseServer
      .from('simulations')
      .select('id, discipline, industry, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (simErr) return NextResponse.json({ error: simErr.message }, { status: 500 })
    if (!sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!await canAccess(ctx.userId, sim)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const section = request.nextUrl.searchParams.get('section')

    let query = supabaseServer
      .from('simulation_comments')
      .select('*')
      .eq('simulation_id', sim.id)
      .order('created_at', { ascending: true })

    if (section) {
      query = query.eq('section_key', section)
    }

    const { data: comments, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ comments: comments ?? [] })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

// POST /api/reviewer/simulations/[slug]/comments
// Body: { section_key, comment, reviewer_label?, selected_text?, timestamp_seconds? }
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireReviewer()
    const { slug } = await params

    const body = await request.json()
    const { section_key, selected_text, comment, reviewer_label, timestamp_seconds } = body as {
      section_key: string
      selected_text?: string
      comment: string
      reviewer_label?: string | null
      timestamp_seconds?: number | null
    }

    if (!section_key || !comment?.trim()) {
      return NextResponse.json({ error: 'section_key and comment are required' }, { status: 400 })
    }
    // Non-video comments require selected_text
    if (section_key !== 'video' && !selected_text?.trim()) {
      return NextResponse.json({ error: 'selected_text is required for non-video comments' }, { status: 400 })
    }

    const { data: sim } = await supabaseServer
      .from('simulations')
      .select('id, discipline, industry, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (!sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!await canAccess(ctx.userId, sim)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: newComment, error } = await supabaseServer
      .from('simulation_comments')
      .insert({
        simulation_id:   sim.id,
        reviewer_id:     ctx.userId,
        reviewer_label:  reviewer_label?.trim() || null,
        section_key,
        selected_text:   selected_text?.trim() || '',
        comment:         comment.trim(),
        timestamp_seconds: typeof timestamp_seconds === 'number' ? timestamp_seconds : null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ comment: newComment }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

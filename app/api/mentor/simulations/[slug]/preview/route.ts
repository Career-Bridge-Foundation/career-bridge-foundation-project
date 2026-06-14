import { NextResponse } from 'next/server'
import { requireMentor } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/mentor/simulations/[slug]/preview
 *
 * A mentor previews gated simulation content (brief, transcript, prompts)
 * WITHOUT consuming a seat. READ-ONLY — there is no write path anywhere.
 *
 * IP BOUNDARY — the access gate runs entirely on server-resolved values:
 *   mentor_user_id = ctx.userId       (the authenticated mentor)
 *   discipline     = sim.discipline   (the sim's OWN discipline, NOT request input)
 *   partner_id     = ctx.partnerId    (defensive: blocks a stale cross-partner grant)
 *   revoked_at IS NULL                (active grants only)
 * The slug from the URL only RESOLVES which sim; it never feeds the gate.
 *
 * 404 for an unknown slug (existence is public via simulations_catalog);
 * 403 when the sim exists but the mentor lacks an active discipline grant.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  let ctx
  try {
    ctx = await requireMentor()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  // Resolve the sim (service-role): public context + the gated columns.
  const { data: sim, error: simErr } = await supabaseServer
    .from('simulations')
    .select(
      'id, slug, title, company, industry, difficulty, description, discipline, brief_short, brief_full, video_transcript, sim_role, video_url'
    )
    .eq('slug', slug)
    .maybeSingle()
  if (simErr) {
    console.error('[mentor/preview] sim lookup failed', simErr.message)
    return NextResponse.json({ error: 'could not load simulation' }, { status: 500 })
  }
  if (!sim) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ── ACCESS GATE — all four filters from server-resolved values; none from input. ──
  const { data: grant, error: grantErr } = await supabaseServer
    .from('mentor_disciplines')
    .select('id')
    .eq('mentor_user_id', ctx.userId)
    .eq('discipline', sim.discipline as string)
    .eq('partner_id', ctx.partnerId!)
    .is('revoked_at', null)
    .maybeSingle()
  if (grantErr) {
    console.error('[mentor/preview] grant check failed', grantErr.message)
    return NextResponse.json({ error: 'could not verify access' }, { status: 500 })
  }
  if (!grant) {
    return NextResponse.json({ error: 'You do not have preview access to this discipline' }, { status: 403 })
  }

  // Granted — fetch gated prompts, ordered.
  const { data: prompts, error: pErr } = await supabaseServer
    .from('simulation_prompts')
    .select('display_order, type, title, question, min_words, time_remaining_minutes, guidance')
    .eq('simulation_id', sim.id)
    .order('display_order', { ascending: true })
  if (pErr) {
    console.error('[mentor/preview] prompts fetch failed', pErr.message)
    return NextResponse.json({ error: 'could not load prompts' }, { status: 500 })
  }

  return NextResponse.json({
    // public catalog context
    slug: sim.slug,
    title: sim.title,
    company: sim.company,
    industry: sim.industry,
    difficulty: sim.difficulty,
    description: sim.description,
    discipline: sim.discipline,
    // gated delta (returned only after the gate passes)
    briefShort: sim.brief_short,
    briefFull: sim.brief_full,
    videoTranscript: sim.video_transcript,
    simRole: sim.sim_role,
    videoUrl: sim.video_url,
    prompts: (prompts ?? []).map((p) => ({
      displayOrder: p.display_order,
      type: p.type,
      title: p.title,
      question: p.question,
      minWords: p.min_words,
      timeRemainingMinutes: p.time_remaining_minutes,
      guidance: p.guidance,
    })),
  })
}

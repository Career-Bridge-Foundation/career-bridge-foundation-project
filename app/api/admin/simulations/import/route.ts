import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { SimulationImportSchema } from '@/lib/schemas/simulation'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ formErrors: ['Invalid JSON'], fieldErrors: {} }, { status: 400 })
  }

  const result = SimulationImportSchema.safeParse(body)
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten()
    return NextResponse.json({ fieldErrors, formErrors }, { status: 400 })
  }

  const { simulations } = result.data

  // Fetch existing slugs to compute diff
  const { data: existing } = await supabaseServer
    .from('simulations')
    .select('slug')

  const existingSlugs = new Set((existing ?? []).map(r => r.slug))

  const toCreate = simulations.filter(s => !existingSlugs.has(s.slug))
  const toUpdate = simulations.filter(s => existingSlugs.has(s.slug))
  const unchanged = 0 // we treat all existing as "updated" for simplicity

  // Upsert inside Supabase (Postgres handles the transaction implicitly for upsert)
  const upsertData = simulations.map(s => ({
    slug: s.slug,
    title: s.title,
    company: s.company,
    industry: s.industry,
    type: s.type ?? null,
    difficulty: s.difficulty,
    time: s.time,
    description: s.description ?? null,
    discipline: s.discipline ?? null,
    video_url: s.video_url ?? null,
    status: s.status ?? 'draft',
    published_at: s.published_at ?? null,
    display_order: s.display_order ?? null,
    sim_role: s.sim_role ?? null,
    brief_short: s.brief_short ?? null,
    brief_full: s.brief_full ?? null,
    video_transcript: s.video_transcript ?? null,
    time_remaining: s.time_remaining ?? [],
    prompts: s.prompts ?? [],
  }))

  const { error } = await supabaseServer
    .from('simulations')
    .upsert(upsertData, { onConflict: 'slug' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    created: toCreate.length,
    updated: toUpdate.length,
    unchanged,
    total: simulations.length,
  })
}

// Preview endpoint — validates and returns diff without writing
export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ formErrors: ['Invalid JSON'], fieldErrors: {} }, { status: 400 })
  }

  const result = SimulationImportSchema.safeParse(body)
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten()
    return NextResponse.json({ fieldErrors, formErrors }, { status: 400 })
  }

  const { simulations } = result.data
  const { data: existing } = await supabaseServer.from('simulations').select('slug')
  const existingSlugs = new Set((existing ?? []).map(r => r.slug))

  const created = simulations.filter(s => !existingSlugs.has(s.slug)).length
  const updated = simulations.filter(s => existingSlugs.has(s.slug)).length

  return NextResponse.json({ created, updated, unchanged: 0, total: simulations.length })
}

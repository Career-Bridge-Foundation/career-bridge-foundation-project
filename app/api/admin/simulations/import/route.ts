import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { SimulationImportSchema } from '@/lib/schemas/simulation'

// NOTE: Multi-table writes (simulations + simulation_prompts + rubrics) are
// NOT atomic. Each Supabase call is separate. A failure mid-import for one
// simulation can leave that simulation in a partial state (e.g. metadata
// and prompts inserted but rubric missing). The `failures` array in the
// response reports which simulations had errors and at which step.
//
// Recovery: re-import the failed simulation. Because the route uses
// delete-then-insert for prompts and rubrics, a re-import always replaces
// any partial state from a previous failed attempt.
//
// For true atomicity, this should be wrapped in a Postgres RPC / function
// that performs all writes in a single transaction. Deferred until needed.

export async function POST(request: NextRequest) {
  try {
    await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
  }

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

  const { data: existing } = await supabaseServer
    .from('simulations')
    .select('slug, published_at')

  const existingSlugs = new Set((existing ?? []).map(r => r.slug))
  const existingPublishedAt = new Map((existing ?? []).map(r => [r.slug, r.published_at as string | null]))

  const created: string[] = []
  const updated: string[] = []
  const failed: { slug: string; error: string }[] = []

  for (const s of simulations) {
    try {
      // 1. Upsert simulation metadata
      const simRow = {
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
        // Mirror the auto-stamp behaviour of the edit ([slug]/route.ts) and
        // approve routes: a row transitioning to 'published' always gets a
        // published_at, even if the import payload omits it. Previously this
        // route wrote published_at straight from the payload with no
        // fallback, leaving 144 rows published with published_at = null.
        published_at: s.published_at
          ?? (s.status === 'published' ? existingPublishedAt.get(s.slug) ?? new Date().toISOString() : null),
        display_order: s.display_order ?? 0,
        sim_role: s.sim_role ?? null,
        brief_short: s.brief_short ?? null,
        brief_full: s.brief_full ?? null,
        video_transcript: s.video_transcript ?? null,
      }

      const { data: upserted, error: simErr } = await supabaseServer
        .from('simulations')
        .upsert(simRow, { onConflict: 'slug' })
        .select('id, slug')
        .single()

      if (simErr || !upserted) {
        failed.push({ slug: s.slug, error: simErr?.message ?? 'simulation upsert returned no row' })
        continue
      }

      const simulationId = upserted.id

      // 2. Delete existing prompts for this simulation (replace strategy)
      const { error: delPromptsErr } = await supabaseServer
        .from('simulation_prompts')
        .delete()
        .eq('simulation_id', simulationId)

      if (delPromptsErr) {
        failed.push({ slug: s.slug, error: `delete prompts: ${delPromptsErr.message}` })
        continue
      }

      // 3. Insert new prompts if any
      const prompts = (s as { prompts?: Array<{
        type: 'typed' | 'url' | 'either'
        title: string
        question: string
        guidance?: string[]
        minWords?: number
        timeRemainingMinutes?: number
      }> }).prompts ?? []

      if (prompts.length > 0) {
        const promptRows = prompts.map((p, idx) => ({
          simulation_id: simulationId,
          display_order: idx + 1,
          type: p.type,
          title: p.title,
          question: p.question,
          guidance: p.guidance ?? [],
          min_words: p.minWords ?? 200,
          time_remaining_minutes: p.timeRemainingMinutes ?? 15,
        }))

        const { error: promptsErr } = await supabaseServer
          .from('simulation_prompts')
          .insert(promptRows)

        if (promptsErr) {
          failed.push({ slug: s.slug, error: `insert prompts: ${promptsErr.message}` })
          continue
        }
      }

      // 4. Delete existing rubrics for this simulation
      const { error: delRubricsErr } = await supabaseServer
        .from('rubrics')
        .delete()
        .eq('simulation_id', simulationId)

      if (delRubricsErr) {
        failed.push({ slug: s.slug, error: `delete rubrics: ${delRubricsErr.message}` })
        continue
      }

      // 5. Insert new rubric if provided
      const rubric = (s as { rubric?: {
        systemPrompt: string
        criteria: unknown
        maxScore: number
        scoringScale: unknown
        verdictBands: unknown
        model?: string
        outputInstructions?: string | null
      } }).rubric

      if (rubric) {
        const { error: rubricErr } = await supabaseServer
          .from('rubrics')
          .insert({
            simulation_id: simulationId,
            simulation_slug: s.slug,
            version: 1,
            is_active: true,
            system_prompt: rubric.systemPrompt,
            criteria: rubric.criteria,
            max_score: rubric.maxScore,
            scoring_scale: rubric.scoringScale,
            verdict_bands: rubric.verdictBands,
            model: rubric.model ?? 'claude-sonnet-4-6',
            output_instructions: rubric.outputInstructions ?? null,
          })

        if (rubricErr) {
          failed.push({ slug: s.slug, error: `insert rubric: ${rubricErr.message}` })
          continue
        }
      }

      if (existingSlugs.has(s.slug)) {
        updated.push(s.slug)
      } else {
        created.push(s.slug)
      }
    } catch (err) {
      failed.push({
        slug: s.slug,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('[import] complete:', {
    created: created.length,
    updated: updated.length,
    failed: failed.length,
    total: simulations.length,
  })

  return NextResponse.json({
    created: created.length,
    updated: updated.length,
    unchanged: 0,
    failed: failed.length,
    total: simulations.length,
    failures: failed,
  })
}

// Preview endpoint — validates and returns diff without writing
export async function PUT(request: NextRequest) {
  try {
    await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
  }

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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/log-activity'

async function getCallerEmail(request: NextRequest): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.email ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data, error } = await supabaseServer
    .from('rubrics')
    .select('id, version, system_prompt, model, max_score, is_active')
    .eq('simulation_slug', slug)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rubrics: data ?? [] })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: { system_prompt?: string; model?: string; max_score?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { system_prompt, model, max_score } = body

  if (!system_prompt || !model || typeof max_score !== 'number' || max_score < 1) {
    return NextResponse.json({ error: 'system_prompt, model, and max_score are required' }, { status: 400 })
  }

  // Determine next version number
  const { data: existing } = await supabaseServer
    .from('rubrics')
    .select('version')
    .eq('simulation_slug', slug)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

  // Deactivate all existing rubrics for this simulation
  const { error: deactivateErr } = await supabaseServer
    .from('rubrics')
    .update({ is_active: false })
    .eq('simulation_slug', slug)

  if (deactivateErr) {
    return NextResponse.json({ error: deactivateErr.message }, { status: 500 })
  }

  // Insert new active version
  const { data: newRubric, error: insertErr } = await supabaseServer
    .from('rubrics')
    .insert({
      simulation_slug: slug,
      version: nextVersion,
      system_prompt,
      model,
      max_score,
      is_active: true,
    })
    .select('id, version, system_prompt, model, max_score, is_active')
    .single()

  if (insertErr || !newRubric) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Activity log (fire-and-forget)
  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (sim) {
    const email = await getCallerEmail(request)
    logActivity({
      simulationId: sim.id,
      userEmail: email,
      action: 'updated_rubric',
      diff: { version: nextVersion, model, max_score },
    })
  }

  return NextResponse.json({ rubric: newRubric })
}

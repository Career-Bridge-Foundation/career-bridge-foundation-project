import { NextRequest, NextResponse } from 'next/server'
import { SimulationContentSchema } from '@/lib/schemas/simulation'
import { supabaseServer } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()

    const result = SimulationContentSchema.safeParse(body)
    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten()
      return NextResponse.json({ fieldErrors, formErrors }, { status: 400 })
    }

    const validated = result.data

    const { data: sim, error: fetchErr } = await supabaseServer
      .from('simulations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (fetchErr || !sim) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    const { error } = await supabaseServer
      .from('simulations')
      .update({
        sim_role: validated.sim_role,
        brief_short: validated.brief_short,
        brief_full: validated.brief_full,
        video_transcript: validated.video_transcript,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { error: deleteErr } = await supabaseServer
      .from('simulation_prompts')
      .delete()
      .eq('simulation_id', sim.id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    const promptRows = validated.prompts.map((prompt, index) => ({
      id: prompt.id,
      simulation_id: sim.id,
      display_order: index + 1,
      type: prompt.type,
      title: prompt.title,
      question: prompt.question,
      min_words: prompt.minWords,
      time_remaining_minutes: validated.time_remaining[index] ?? 0,
      updated_at: new Date().toISOString(),
    }))

    const { error: insertErr } = await supabaseServer
      .from('simulation_prompts')
      .insert(promptRows)

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const email = await getCallerEmail(request)
    logActivity({
      simulationId: sim.id,
      userEmail: email,
      action: 'updated_content',
      diff: { promptCount: validated.prompts.length },
    })

    return NextResponse.json({ success: true, data: validated })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

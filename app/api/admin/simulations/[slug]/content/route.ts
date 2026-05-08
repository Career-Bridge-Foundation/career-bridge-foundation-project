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
    const resequenced = {
      ...validated,
      prompts: validated.prompts.map((p, i) => ({ ...p, id: i + 1 })),
    }

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
        sim_role: resequenced.sim_role,
        brief_short: resequenced.brief_short,
        brief_full: resequenced.brief_full,
        video_transcript: resequenced.video_transcript,
        time_remaining: resequenced.time_remaining,
        prompts: resequenced.prompts,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const email = await getCallerEmail(request)
    logActivity({
      simulationId: sim.id,
      userEmail: email,
      action: 'updated_content',
      diff: { promptCount: resequenced.prompts.length },
    })

    return NextResponse.json({ success: true, data: resequenced })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

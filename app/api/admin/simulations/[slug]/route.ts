import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { SimulationMetadataSchema } from '@/lib/schemas/simulation'
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
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { data, error } = await supabaseServer
    .from('simulations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ formErrors: ['Invalid JSON'], fieldErrors: {} }, { status: 400 })
  }

  const result = SimulationMetadataSchema.safeParse(body)
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten()
    return NextResponse.json({ fieldErrors, formErrors }, { status: 400 })
  }

  const { data: before } = await supabaseServer
    .from('simulations')
    .select('*')
    .eq('slug', slug)
    .single()

  const updatePayload: Record<string, unknown> = { ...result.data }
  if (result.data.status === 'published' && !before?.published_at) {
    updatePayload.published_at = new Date().toISOString()
  }

  const { data, error } = await supabaseServer
    .from('simulations')
    .update(updatePayload)
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { fieldErrors: { slug: ['Slug is already taken'] }, formErrors: [] },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const email = await getCallerEmail(request)
  logActivity({
    simulationId: data.id,
    userEmail: email,
    action: 'updated_metadata',
    diff: { before, after: result.data },
  })

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('id, title')
    .eq('slug', slug)
    .single()

  const { error } = await supabaseServer.from('simulations').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (sim) {
    const email = await getCallerEmail(request)
    logActivity({
      simulationId: sim.id,
      userEmail: email,
      action: 'deleted',
      diff: { title: sim.title, slug },
    })
  }

  return new NextResponse(null, { status: 204 })
}

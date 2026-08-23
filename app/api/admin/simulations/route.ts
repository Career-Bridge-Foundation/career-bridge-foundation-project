import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { SimulationMetadataSchema } from '@/lib/schemas/simulation'
import { logActivity } from '@/lib/supabase/log-activity'
import { requireStaff } from '@/lib/auth/permissions'

async function getCallerEmail(request: NextRequest): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.email ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET() {
  try {
    await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseServer
    .from('simulations')
    .select('slug, title, company, industry, discipline, difficulty, time, status, published_at, display_order, updated_at')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

  const { data: top } = await supabaseServer
    .from('simulations')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const display_order = (top?.display_order ?? 0) + 1

  const { data, error } = await supabaseServer
    .from('simulations')
    .insert({ ...result.data, display_order })
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
  logActivity({ simulationId: data.id, userEmail: email, action: 'created' })

  return NextResponse.json(data, { status: 201 })
}

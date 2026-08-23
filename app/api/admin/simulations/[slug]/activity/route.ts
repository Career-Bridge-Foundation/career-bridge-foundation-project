import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireStaff()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const { data: sim } = await supabaseServer
    .from('simulations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!sim) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabaseServer
    .from('simulation_activity')
    .select('id, action, user_email, diff, created_at')
    .eq('simulation_id', sim.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

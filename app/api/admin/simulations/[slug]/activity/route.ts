import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') ?? ''
  const except = request.nextUrl.searchParams.get('except') ?? ''

  if (!slug || slug.length < 2) return NextResponse.json({ available: false })

  let query = supabaseServer
    .from('simulations')
    .select('slug', { count: 'exact', head: true })
    .eq('slug', slug)

  if (except) query = query.neq('slug', except)

  const { count, error } = await query
  if (error) return NextResponse.json({ available: false })

  return NextResponse.json({ available: (count ?? 1) === 0 })
}

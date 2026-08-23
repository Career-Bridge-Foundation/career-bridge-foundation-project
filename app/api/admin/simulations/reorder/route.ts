import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ReorderSchema } from '@/lib/validations/simulation'
import { requireStaff } from '@/lib/auth/permissions'

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

  const result = ReorderSchema.safeParse(body)
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten()
    return NextResponse.json({ fieldErrors, formErrors }, { status: 400 })
  }

  const results = await Promise.all(
    result.data.map(({ slug, display_order }) =>
      supabaseServer.from('simulations').update({ display_order }).eq('slug', slug)
    )
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

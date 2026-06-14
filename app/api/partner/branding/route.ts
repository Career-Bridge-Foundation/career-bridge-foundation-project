import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { isValidHexColor } from '@/lib/validation/hexColor'

export const runtime = 'nodejs'

/**
 * PATCH /api/partner/branding — a partner updates their OWN brand colours.
 *
 * SCOPING (structural): partnerId comes ONLY from requirePartner()'s ctx. The
 * body is destructured to {primary_color, secondary_color} — no partner_id/id is
 * ever read from the body — and the row is selected solely by ctx.partnerId. A
 * body carrying a foreign partner_id/id is inert. Service-role write (partners
 * RLS is staff-only; partners have no RLS write path), so code is the boundary.
 *
 * primary_color: required-shape when present, valid hex, NOT clearable.
 * secondary_color: valid hex OR null (clearable).
 */
export async function PATCH(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // Destructure ONLY the colour fields — nothing else from the body is referenced.
  const { primary_color, secondary_color } = (body ?? {}) as {
    primary_color?: unknown
    secondary_color?: unknown
  }

  if (primary_color !== undefined && (typeof primary_color !== 'string' || !isValidHexColor(primary_color))) {
    return NextResponse.json({ error: 'primary_color must be a valid hex colour (#RGB or #RRGGBB)' }, { status: 400 })
  }
  if (
    secondary_color !== undefined &&
    secondary_color !== null &&
    (typeof secondary_color !== 'string' || !isValidHexColor(secondary_color))
  ) {
    return NextResponse.json({ error: 'secondary_color must be a valid hex colour or null' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if (primary_color !== undefined) updates.primary_color = primary_color as string
  if (secondary_color !== undefined) updates.secondary_color = (secondary_color as string | null) ?? null
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no branding fields to update' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()

  // Scoped write: the authenticated partner id is the only selector.
  const { data, error } = await supabaseServer
    .from('partners')
    .update(updates)
    .eq('id', ctx.partnerId)
    .select('primary_color, secondary_color')
    .maybeSingle()

  if (error) {
    console.error('[partner/branding] update failed', error.message)
    return NextResponse.json({ error: 'could not save branding' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...data }, { status: 200 })
}

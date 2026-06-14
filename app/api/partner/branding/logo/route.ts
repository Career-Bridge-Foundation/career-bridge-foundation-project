import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { sniffRasterImage, imageExt, imageMime } from '@/lib/validation/imageType'

export const runtime = 'nodejs'

const BUCKET = 'branding'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

// Allowlisted slot → column. The column name is ONLY ever one of these three
// literals — an invalid slot yields undefined → 400, so no arbitrary column on
// the partners row is reachable from user input.
const SLOT_COLUMN = {
  icon: 'logo_url_icon',
  on_light: 'logo_url_on_light',
  on_dark: 'logo_url_on_dark',
} as const
type Slot = keyof typeof SLOT_COLUMN

function resolveColumn(slot: unknown): (typeof SLOT_COLUMN)[Slot] | null {
  return typeof slot === 'string' && slot in SLOT_COLUMN ? SLOT_COLUMN[slot as Slot] : null
}

/**
 * POST /api/partner/branding/logo — multipart upload of one logo slot.
 *
 * Scoping (structural, same boundary as the colours PATCH):
 *  - partnerId comes only from requirePartner() ctx.
 *  - storage path = `${ctx.partnerId}/...` — NO client-supplied path component,
 *    so a partner can only ever write into their own folder.
 *  - column = allowlisted SLOT_COLUMN[slot] — never an arbitrary column.
 *  - the partners row is selected solely by .eq('id', ctx.partnerId).
 *  - file type is sniffed from CONTENT (sniffRasterImage); the declared
 *    Content-Type / filename are ignored (SVG + spoofed types rejected).
 */
export async function POST(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'expected multipart form data' }, { status: 400 })

  const column = resolveColumn(form.get('slot'))
  if (!column) return NextResponse.json({ error: 'invalid slot' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file exceeds the 2 MB limit' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffRasterImage(bytes) // CONTENT-based; ignores declared type/extension
  if (!type) return NextResponse.json({ error: 'file must be a PNG, JPEG, or WebP image' }, { status: 400 })

  const slot = form.get('slot') as string
  // Path from context id only — no client path component.
  const path = `${ctx.partnerId}/${slot}-${Date.now()}.${imageExt(type)}`

  const up = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: imageMime(type), upsert: true })
  if (up.error) {
    console.error('[partner/branding/logo] upload failed', up.error.message)
    return NextResponse.json({ error: 'could not upload logo' }, { status: 500 })
  }

  const url = supabaseServer.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const { error } = await supabaseServer
    .from('partners')
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq('id', ctx.partnerId)
  if (error) {
    console.error('[partner/branding/logo] column write failed', error.message)
    return NextResponse.json({ error: 'could not save logo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slot, url }, { status: 200 })
}

/**
 * DELETE /api/partner/branding/logo?slot=icon — clear one logo slot (revert to
 * the Evidentize fallback). Sets the column null; storage file is left in place
 * (orphaned-file cleanup is deferred — public bucket, harmless).
 */
export async function DELETE(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const column = resolveColumn(new URL(request.url).searchParams.get('slot'))
  if (!column) return NextResponse.json({ error: 'invalid slot' }, { status: 400 })

  const { error } = await supabaseServer
    .from('partners')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('id', ctx.partnerId)
  if (error) {
    console.error('[partner/branding/logo] clear failed', error.message)
    return NextResponse.json({ error: 'could not remove logo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

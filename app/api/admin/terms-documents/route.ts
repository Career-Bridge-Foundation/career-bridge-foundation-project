import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/admin/terms-documents — publish (and activate) a new version of
 * a document. Super-admin only, per Spec 19's own decision: partner
 * programme terms are published by super-admin on the partner's behalf in
 * this slice — partner self-serve publishing would mean partner-admins
 * editing legal text with no review step.
 *
 * Activating a new version deactivates the previously-active one for the
 * same (document_type, partner_id) — but that row is NEVER deleted or
 * edited; candidates who already accepted it keep that acceptance on record
 * permanently (Spec 19 decision 5), they're just re-prompted for the new
 * version at their next request.
 */
export async function POST(request: NextRequest) {
  let ctx
  try {
    ctx = await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const body = (json ?? {}) as {
    document_type?: unknown
    partner_id?: unknown
    version?: unknown
    body?: unknown
  }

  if (body.document_type !== 'platform_terms' && body.document_type !== 'partner_programme_terms') {
    return NextResponse.json({ error: 'document_type must be platform_terms or partner_programme_terms' }, { status: 400 })
  }
  const partnerId = body.document_type === 'partner_programme_terms' ? body.partner_id : null
  if (body.document_type === 'partner_programme_terms' && (typeof partnerId !== 'string' || !partnerId)) {
    return NextResponse.json({ error: 'partner_programme_terms requires partner_id' }, { status: 400 })
  }
  if (typeof body.version !== 'string' || !body.version.trim()) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const documentHash = createHash('sha256').update(body.body).digest('hex')

  // Two-step, not atomic (per this repo's convention for multi-row writes
  // that aren't wrapped in an RPC — CLAUDE.md "Database-touching code"):
  // deactivate the currently-active version first, then insert the new one
  // active. A failure between the two leaves NO active version rather than
  // two — fail-safe in the direction of re-prompting rather than silently
  // skipping the gate.
  const { error: deactivateError } = await supabaseServer
    .from('terms_documents')
    .update({ is_active: false })
    .eq('document_type', body.document_type)
    .eq('is_active', true)
    .filter('partner_id', partnerId ? 'eq' : 'is', partnerId ?? null)

  if (deactivateError) {
    console.error('[admin/terms-documents] deactivate failed', deactivateError.message)
    return NextResponse.json({ error: deactivateError.message }, { status: 500 })
  }

  const { data: created, error: insertError } = await supabaseServer
    .from('terms_documents')
    .insert({
      document_type: body.document_type,
      partner_id: partnerId ?? null,
      version: body.version.trim(),
      body: body.body,
      document_hash: documentHash,
      is_active: true,
      created_by: ctx.userId,
    })
    .select('id, version, published_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'that version already exists for this document' }, { status: 409 })
    }
    console.error('[admin/terms-documents] insert failed', insertError.message)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, document: created }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { publishTermsVersion } from '@/lib/terms/publishVersion'

export const runtime = 'nodejs'

/**
 * POST /api/admin/terms-documents — publish (and activate) a new version of
 * the Evidentize PLATFORM terms only. Partner programme terms are now
 * authored by the partner themselves on their own dashboard (POST
 * /api/partner/terms-documents) — super-admin no longer publishes on a
 * partner's behalf, so partner_programme_terms is rejected here.
 *
 * Activating a new version deactivates the previously-active one — but that
 * row is NEVER deleted or edited; candidates who already accepted it keep
 * that acceptance on record permanently (Spec 19 decision 5), they're just
 * re-prompted for the new version at their next request.
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
  const body = (json ?? {}) as { document_type?: unknown; version?: unknown; body?: unknown }

  if (body.document_type !== 'platform_terms') {
    return NextResponse.json(
      { error: 'this endpoint only publishes platform_terms — partner programme terms are published by the partner themselves' },
      { status: 400 }
    )
  }
  if (typeof body.version !== 'string' || !body.version.trim()) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const documentHash = createHash('sha256').update(body.body).digest('hex')

  const result = await publishTermsVersion({
    documentType: 'platform_terms',
    partnerId: null,
    version: body.version.trim(),
    documentHash,
    createdBy: ctx.userId,
    body: body.body,
    sourceStoragePath: null,
    sourceFileType: null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true, document: result.document }, { status: 201 })
}

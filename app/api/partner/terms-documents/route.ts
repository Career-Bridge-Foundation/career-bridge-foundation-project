import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { publishTermsVersion } from '@/lib/terms/publishVersion'

export const runtime = 'nodejs'

const BUCKET = 'partner-terms-documents'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/partner/terms-documents — a partner publishes their own
 * programme terms. Always document_type='partner_programme_terms',
 * partner_id is ALWAYS the caller's own (never accepted from the client) —
 * there is no path here for one partner to publish under another's id.
 *
 * Accepts multipart/form-data with `version` plus EITHER `body` (manual
 * text) OR `file` (PDF) — never both. A PDF is hashed by its raw bytes and
 * stored in the private partner-terms-documents bucket; a text body is
 * hashed the same way the platform-terms path always has been.
 */
export async function POST(request: NextRequest) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const partnerId = ctx.partnerId as string

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  const version = (form.get('version') as string | null)?.trim()
  if (!version) {
    return NextResponse.json({ error: 'version is required' }, { status: 400 })
  }

  const textBody = (form.get('body') as string | null)?.trim() || null
  const file = form.get('file')
  const hasFile = file instanceof File && file.size > 0

  if (textBody && hasFile) {
    return NextResponse.json({ error: 'provide either text or a file, not both' }, { status: 400 })
  }
  if (!textBody && !hasFile) {
    return NextResponse.json({ error: 'document text or a file is required' }, { status: 400 })
  }

  let documentHash: string
  let sourceStoragePath: string | null = null
  let sourceFileType: string | null = null
  let body: string | null = null

  if (hasFile) {
    const f = file as File
    if (f.type !== 'application/pdf') {
      return NextResponse.json({ error: 'only PDF uploads are supported' }, { status: 400 })
    }
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'file must be under 10MB' }, { status: 400 })
    }
    const bytes = Buffer.from(await f.arrayBuffer())
    documentHash = createHash('sha256').update(bytes).digest('hex')
    sourceStoragePath = `${partnerId}/${documentHash}.pdf`
    sourceFileType = 'pdf'

    const { error: uploadError } = await supabaseServer.storage
      .from(BUCKET)
      .upload(sourceStoragePath, bytes, { contentType: 'application/pdf', upsert: true })
    if (uploadError) {
      console.error('[partner/terms-documents] upload failed', uploadError.message)
      return NextResponse.json({ error: 'could not upload file' }, { status: 500 })
    }
  } else {
    body = textBody
    documentHash = createHash('sha256').update(body as string).digest('hex')
  }

  const result = await publishTermsVersion({
    documentType: 'partner_programme_terms',
    partnerId,
    version,
    documentHash,
    createdBy: ctx.userId,
    body,
    sourceStoragePath,
    sourceFileType,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true, document: result.document }, { status: 201 })
}

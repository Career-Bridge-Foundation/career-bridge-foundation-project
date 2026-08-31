import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { encryptCredential, lastFour } from '@/lib/partners/communityCredential'
import { isSupportedCommunityProvider, SUPPORTED_COMMUNITY_PROVIDERS } from '@/lib/partners/communityProviders'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/partners/[partnerId]/community — configure a partner's
 * community provisioning (Spec 19.3). Super-admin only, matching every
 * other partner-infra endpoint. `credential` is optional per request:
 * omitting it leaves whatever's already stored untouched (this is the
 * rotation UX — the field starts blank in the UI, and only submitting a new
 * value overwrites the old one). Sending an empty string clears it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { partnerId } = await params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const body = (json ?? {}) as {
    community_provider?: unknown
    community_url?: unknown
    community_space_id?: unknown
    community_enabled?: unknown
    credential?: unknown
  }

  const updates: Record<string, string | boolean | null> = {}

  if ('community_provider' in body) {
    if (body.community_provider !== null && typeof body.community_provider !== 'string') {
      return NextResponse.json({ error: 'community_provider must be a string or null' }, { status: 400 })
    }
    const provider = (body.community_provider as string | null) || null
    if (provider && !isSupportedCommunityProvider(provider)) {
      return NextResponse.json(
        {
          error: `unsupported community_provider — must be one of: ${SUPPORTED_COMMUNITY_PROVIDERS.map((p) => p.value).join(', ')}`,
        },
        { status: 400 }
      )
    }
    updates.community_provider = provider
  }
  if ('community_url' in body) {
    if (body.community_url !== null && typeof body.community_url !== 'string') {
      return NextResponse.json({ error: 'community_url must be a string or null' }, { status: 400 })
    }
    const url = (body.community_url as string | null)?.trim() || null
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'community_url must start with http:// or https://' }, { status: 400 })
    }
    updates.community_url = url
  }
  if ('community_space_id' in body) {
    if (body.community_space_id !== null && typeof body.community_space_id !== 'string') {
      return NextResponse.json({ error: 'community_space_id must be a string or null' }, { status: 400 })
    }
    updates.community_space_id = (body.community_space_id as string | null) || null
  }
  if ('community_enabled' in body) {
    if (typeof body.community_enabled !== 'boolean') {
      return NextResponse.json({ error: 'community_enabled must be a boolean' }, { status: 400 })
    }
    updates.community_enabled = body.community_enabled
  }
  if ('credential' in body) {
    if (typeof body.credential !== 'string') {
      return NextResponse.json({ error: 'credential must be a string' }, { status: 400 })
    }
    if (body.credential === '') {
      updates.community_credential_ref = null
      updates.community_credential_last4 = null
    } else {
      try {
        updates.community_credential_ref = encryptCredential(body.credential)
        updates.community_credential_last4 = lastFour(body.credential)
      } catch (err) {
        console.error('[admin/partners/community] encryption failed', err)
        return NextResponse.json({ error: 'server misconfiguration — credential encryption unavailable' }, { status: 500 })
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('partners')
    .update(updates)
    .eq('id', partnerId)

  if (error) {
    console.error('[admin/partners/community] update failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

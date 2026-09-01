import { NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * PATCH /api/partner/community-url — a partner sets their own community
 * invite link (e.g. a Circle invite link they generated themselves). No
 * provider API involved — this is just a link shown to candidates.
 */
export async function PATCH(request: Request) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const raw = (json as { community_url?: unknown })?.community_url
  if (raw !== null && typeof raw !== 'string') {
    return NextResponse.json({ error: 'community_url must be a string or null' }, { status: 400 })
  }
  const communityUrl = (raw as string | null)?.trim() || null
  if (communityUrl && !/^https?:\/\//i.test(communityUrl)) {
    return NextResponse.json({ error: 'community_url must start with http:// or https://' }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('partners')
    .update({ community_url: communityUrl })
    .eq('id', ctx.partnerId as string)

  if (error) {
    console.error('[partner/community-url] update failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

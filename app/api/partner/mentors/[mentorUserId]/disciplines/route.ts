import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { verifyMentorBelongsToPartner } from '@/lib/partners/mentorScope'
import { availableDisciplineNames } from '@/lib/disciplines-data'

export const runtime = 'nodejs'

/**
 * Grant / revoke a discipline preview-grant for a mentor of THIS partner.
 *
 * partner_id is FORCED from ctx; the mentor is verified in-partner BEFORE any
 * write (mentor-not-in-partner → 404, doesn't leak other orgs' mentors).
 * Soft-revoke convention (revoked_at); a re-grant of a revoked row reactivates
 * via the UNIQUE(mentor_user_id, discipline, partner_id) upsert — never errors.
 * Validates against the global AVAILABLE_DISCIPLINES — see issue #64 (no
 * partner-offered set yet).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mentorUserId: string }> }
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { mentorUserId } = await params
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    const { discipline } = body as { discipline?: string }
    if (!discipline) return NextResponse.json({ error: 'discipline is required' }, { status: 400 })
    if (!availableDisciplineNames.includes(discipline)) {
      return NextResponse.json({ error: 'unknown or unavailable discipline' }, { status: 400 })
    }

    // ISOLATION: the mentor must belong to THIS partner.
    const ok = await verifyMentorBelongsToPartner(mentorUserId, ctx.partnerId!)
    if (!ok) {
      return NextResponse.json(
        { error: 'No mentor with that id in your organisation' },
        { status: 404 }
      )
    }

    // Reactivate-or-insert. partner_id FORCED from ctx.
    const { data: written, error: upErr } = await supabaseServer
      .from('mentor_disciplines')
      .upsert(
        {
          mentor_user_id: mentorUserId,
          discipline,
          partner_id: ctx.partnerId, // FORCED from ctx
          granted_by: ctx.userId,
          revoked_at: null, // reactivates a previously-revoked grant
        },
        { onConflict: 'mentor_user_id,discipline,partner_id' }
      )
      .select('discipline, revoked_at')
      .maybeSingle()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ success: true, discipline: written?.discipline ?? discipline })
  } catch (err) {
    console.error('[partner/mentors/disciplines POST]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mentorUserId: string }> }
) {
  let ctx
  try {
    ctx = await requirePartner()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { mentorUserId } = await params
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
    const { discipline } = body as { discipline?: string }
    if (!discipline) return NextResponse.json({ error: 'discipline is required' }, { status: 400 })
    // No AVAILABLE check on revoke — must be able to revoke a now-unavailable grant.

    const ok = await verifyMentorBelongsToPartner(mentorUserId, ctx.partnerId!)
    if (!ok) {
      return NextResponse.json(
        { error: 'No mentor with that id in your organisation' },
        { status: 404 }
      )
    }

    const { error: revErr } = await supabaseServer
      .from('mentor_disciplines')
      .update({ revoked_at: new Date().toISOString() })
      .eq('mentor_user_id', mentorUserId)
      .eq('discipline', discipline)
      .eq('partner_id', ctx.partnerId!) // scope in WHERE (defense in depth)
      .is('revoked_at', null)
    if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[partner/mentors/disciplines DELETE]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'
import { verifyMentorBelongsToPartner } from '@/lib/partners/mentorScope'
import { getPartnerCandidates } from '@/lib/partners/candidateProgress'

export const runtime = 'nodejs'

/**
 * Assign / unassign a candidate to a mentor of THIS partner — the isolation
 * crux. BEFORE any write, BOTH must hold:
 *   (i)  the mentor belongs to ctx.partnerId           (else 404)
 *   (ii) the candidate is in getPartnerCandidates(ctx) (else 403)
 *
 * (ii) is load-bearing: partner_id is forced to ctx and the candidate FK only
 * proves the user exists — NOT that they're this partner's. Without (ii) a
 * forged candidate_user_id would link this partner to another org's candidate,
 * which the mentor portal (which trusts mentor_candidates) would then surface.
 * Soft-revoke for unassign; re-assign reactivates via UNIQUE(mentor,candidate).
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
    const { candidateUserId } = body as { candidateUserId?: string }
    if (!candidateUserId) {
      return NextResponse.json({ error: 'candidateUserId is required' }, { status: 400 })
    }

    // (i) ISOLATION — mentor in partner (cheap single-row; fail fast). 404.
    const mentorOk = await verifyMentorBelongsToPartner(mentorUserId, ctx.partnerId!)
    if (!mentorOk) {
      return NextResponse.json(
        { error: 'No mentor with that id in your organisation' },
        { status: 404 }
      )
    }

    // (ii) ISOLATION CRUX — candidate in THIS partner's roster (the boundary). 403.
    const roster = await getPartnerCandidates(ctx.partnerId!)
    if (!roster.some((r) => r.userId === candidateUserId)) {
      return NextResponse.json(
        { error: 'That candidate is not in your roster' },
        { status: 403 }
      )
    }

    // Reactivate-or-insert. partner_id FORCED from ctx.
    const { data: written, error: upErr } = await supabaseServer
      .from('mentor_candidates')
      .upsert(
        {
          mentor_user_id: mentorUserId,
          candidate_user_id: candidateUserId,
          partner_id: ctx.partnerId, // FORCED from ctx
          assigned_by: ctx.userId,
          revoked_at: null, // reactivates a previously-revoked assignment
        },
        { onConflict: 'mentor_user_id,candidate_user_id' }
      )
      .select('candidate_user_id, revoked_at')
      .maybeSingle()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      candidateUserId: written?.candidate_user_id ?? candidateUserId,
    })
  } catch (err) {
    console.error('[partner/mentors/candidates POST]', err)
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
    const { candidateUserId } = body as { candidateUserId?: string }
    if (!candidateUserId) {
      return NextResponse.json({ error: 'candidateUserId is required' }, { status: 400 })
    }

    // Mentor-in-partner for a clean 404. The partner_id WHERE below already
    // makes it impossible to touch another partner's rows, so no candidate
    // check is needed to unassign.
    const mentorOk = await verifyMentorBelongsToPartner(mentorUserId, ctx.partnerId!)
    if (!mentorOk) {
      return NextResponse.json(
        { error: 'No mentor with that id in your organisation' },
        { status: 404 }
      )
    }

    const { error: revErr } = await supabaseServer
      .from('mentor_candidates')
      .update({ revoked_at: new Date().toISOString() })
      .eq('mentor_user_id', mentorUserId)
      .eq('candidate_user_id', candidateUserId)
      .eq('partner_id', ctx.partnerId!) // scope in WHERE (defense in depth)
      .is('revoked_at', null)
    if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[partner/mentors/candidates DELETE]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

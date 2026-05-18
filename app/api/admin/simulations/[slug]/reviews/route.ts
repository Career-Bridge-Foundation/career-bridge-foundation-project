import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/permissions'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAdmin()
    const { slug } = await params

    const { data: sim, error: simErr } = await supabaseServer
      .from('simulations')
      .select('id, title, slug, cert_status, cert_notes, certified_by, certified_at')
      .eq('slug', slug)
      .single()

    if (simErr || !sim) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: comments, error: commErr } = await supabaseServer
      .from('simulation_comments')
      .select('id, reviewer_id, reviewer_label, section_key, selected_text, comment, timestamp_seconds, created_at')
      .eq('simulation_id', sim.id)
      .order('created_at', { ascending: true })

    if (commErr) return NextResponse.json({ error: commErr.message }, { status: 500 })

    // Enrich with reviewer emails from user_roles
    const reviewerIds = [...new Set((comments ?? []).map(c => c.reviewer_id))]
    let emailMap: Record<string, string> = {}
    if (reviewerIds.length > 0) {
      const { data: roles } = await supabaseServer
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', reviewerIds)
      for (const r of roles ?? []) {
        if (r.email) emailMap[r.user_id] = r.email
      }
    }

    // Enrich certified_by email
    let certifiedByEmail: string | null = null
    if (sim.certified_by) {
      certifiedByEmail = emailMap[sim.certified_by] ?? null
      if (!certifiedByEmail) {
        const { data: certRole } = await supabaseServer
          .from('user_roles')
          .select('email')
          .eq('user_id', sim.certified_by)
          .maybeSingle()
        certifiedByEmail = certRole?.email ?? null
      }
    }

    const enrichedComments = (comments ?? []).map(c => ({
      ...c,
      reviewer_email: emailMap[c.reviewer_id] ?? null,
    }))

    return NextResponse.json({
      simulation: {
        ...sim,
        certified_by_email: certifiedByEmail,
      },
      comments: enrichedComments,
    })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

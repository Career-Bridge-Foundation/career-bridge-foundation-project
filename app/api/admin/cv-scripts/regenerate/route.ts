import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/permissions';
import { supabaseServer } from '@/lib/supabase/server';
import { runCvScriptGeneration } from '@/lib/cv-scripts/orchestrate';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/cv-scripts/regenerate
 *
 * Super-admin only (Spec 17 §8). Forces regeneration bypassing the normal
 * idempotency and band-improvement gates — for generator_version bumps or
 * recovering from a "failed twice" flag (Spec 17 §9).
 *
 * Body: either { sessionId } directly, or { candidateUserId, simulationSlug }
 * to resolve the most recent evaluated session for that pair.
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden — super-admin access required' }, { status: 403 });
  }

  let body: { sessionId?: string; candidateUserId?: string; simulationSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let sessionId = body.sessionId ?? null;

  if (!sessionId) {
    if (!body.candidateUserId || !body.simulationSlug) {
      return NextResponse.json(
        { error: 'Provide either sessionId, or both candidateUserId and simulationSlug' },
        { status: 400 }
      );
    }
    const { data: session } = await supabaseServer
      .from('simulation_sessions')
      .select('id')
      .eq('user_id', body.candidateUserId)
      .eq('simulation_slug', body.simulationSlug)
      .eq('status', 'evaluated')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'No evaluated session found for that candidate/simulation' }, { status: 404 });
    }
    sessionId = session.id;
  }

  try {
    const results = await runCvScriptGeneration(sessionId as string, { force: true });
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[admin/cv-scripts/regenerate] unexpected error', err);
    return NextResponse.json({ error: 'regeneration failed' }, { status: 500 });
  }
}

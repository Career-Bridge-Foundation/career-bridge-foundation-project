import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/permissions';
import { runCvScriptGeneration } from '@/lib/cv-scripts/orchestrate';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── 1. Auth ──────────────────────────────────────────────────
// The primary caller (POST /api/certifier/issue) invokes
// runCvScriptGeneration() directly in-process, not over HTTP — this repo has
// no queue/waitUntil infrastructure, so a real fire-and-forget network call
// would have no guaranteed completion on serverless. This HTTP route exists
// as a thin wrapper for manual/staff-triggered generation (debugging a
// candidate's missing scripts) and for POST /api/admin/cv-scripts/regenerate
// to share one implementation. No internal-service auth convention exists in
// this codebase, so this is gated the same as any other staff route.
export async function POST(request: NextRequest) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Forbidden — staff access required' }, { status: 403 });
  }

  // ── 2. Parse body ────────────────────────────────────────────
  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = body.sessionId;
    if (!sessionId) throw new Error('missing sessionId');
  } catch {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  // ── 3. Run the generation pipeline ──────────────────────────
  // Non-assessed / missing-scenario-context rejection happens inside
  // buildGenerationInput (Spec 14 decision 7 style — explicit at entry).
  try {
    const results = await runCvScriptGeneration(sessionId);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[internal/cv-scripts/generate] unexpected error', err);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}

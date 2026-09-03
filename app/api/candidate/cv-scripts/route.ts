import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/candidate/cv-scripts
 *
 * Returns the authenticated candidate's own current CV/LinkedIn script rows.
 * Optional ?scope=simulation|discipline_summary and ?discipline= filters.
 * Pattern mirrors app/api/candidate/entitlement/route.ts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = request.nextUrl.searchParams.get('scope');
    const discipline = request.nextUrl.searchParams.get('discipline');

    let query = supabaseServer
      .from('candidate_cv_scripts')
      .select('id, scope, simulation_slug, discipline, verdict_band, completed_count, formats, generated_at')
      .eq('candidate_user_id', user.id)
      .eq('is_current', true)
      .order('generated_at', { ascending: false });

    if (scope === 'simulation' || scope === 'discipline_summary') {
      query = query.eq('scope', scope);
    }
    if (discipline) {
      query = query.eq('discipline', discipline);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ scripts: data ?? [] });
  } catch (err) {
    console.error('[candidate/cv-scripts] unexpected error', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { supabaseServer as adminSupabase } from '@/lib/supabase/server';
import { achievingResult } from '@/lib/portfolio/highestVerdictBand';
import { PortfolioEditPageContent } from './PortfolioEditPageContent';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

const PAGE_BACKGROUND = `
  radial-gradient(ellipse at 75% 0%, rgba(77,197,210,0.07) 0%, transparent 55%),
  radial-gradient(ellipse at 10% 80%, rgba(0,51,89,0.04) 0%, transparent 50%),
  #FAFAFA
`;

type EvidenceItem = {
  id:            string;
  simulation_id: string;
  session_id:    string | null;
  title:         string;
  description:   string | null;
  evidence_type: 'image' | 'pdf' | 'document' | 'link';
  file_url:      string | null;
  external_url:  string | null;
  is_visible:    boolean;
  sort_order:    number;
  uploaded_at:   string;
};

type EditableSimulation = {
  simulationSlug:   string;
  title:            string;
  discipline:       string;
  highestBand:      string;
  achievedAt:       string;
  showOnPortfolio:  boolean;
  showScores:       boolean;
  showFeedback:     boolean;
  evidence:         EvidenceItem[];
  debriefId:        string | null;
  showDebrief:      boolean;
};

async function loadEditableSimulations(userId: string): Promise<EditableSimulation[]> {
  // Read with the service-role admin client. The user is already
  // authenticated and we constrain every query by their user_id, so this
  // is safe; we use admin to avoid relying on per-table RLS for reads.
  const [
    { data: sessions },
    { data: evals },
    { data: visibility },
    { data: simRows },
    { data: evidenceRows },
    { data: debriefRows },
  ] = await Promise.all([
    adminSupabase
      .from('simulation_sessions')
      .select('simulation_slug, discipline')
      .eq('user_id', userId)
      .eq('status', 'evaluated'),
    adminSupabase
      .from('evaluation_results')
      .select('simulation_slug, verdict_band, evaluated_at')
      .eq('user_id', userId),
    adminSupabase
      .from('portfolio_simulation_visibility')
      .select('simulation_id, show_on_portfolio, show_scores, show_feedback')
      .eq('user_id', userId),
    adminSupabase
      .from('simulations')
      .select('slug, title'),
    adminSupabase
      .from('portfolio_evidence')
      .select('id, simulation_id, session_id, title, description, evidence_type, file_url, external_url, is_visible, sort_order, uploaded_at')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    adminSupabase
      .from('debriefs')
      .select('id, is_visible, simulation_sessions!inner(simulation_slug)')
      .eq('user_id', userId)
      .eq('status', 'approved'),
  ]);

  const disciplineBySlug = new Map<string, string>();
  for (const s of sessions ?? []) disciplineBySlug.set(s.simulation_slug, s.discipline);

  const titleBySlug = new Map<string, string>();
  for (const s of simRows ?? []) titleBySlug.set(s.slug, s.title ?? s.slug);

  const visibilityBySlug = new Map<
    string,
    { showOnPortfolio: boolean; showScores: boolean; showFeedback: boolean }
  >();
  for (const v of visibility ?? []) {
    visibilityBySlug.set(v.simulation_id, {
      showOnPortfolio: v.show_on_portfolio,
      showScores:      v.show_scores,
      showFeedback:    v.show_feedback,
    });
  }

  const evalsBySlug = new Map<string, Array<{ verdict_band: string; evaluated_at: string }>>();
  for (const e of evals ?? []) {
    const bucket = evalsBySlug.get(e.simulation_slug) ?? [];
    bucket.push({ verdict_band: e.verdict_band, evaluated_at: e.evaluated_at });
    evalsBySlug.set(e.simulation_slug, bucket);
  }

  const evidenceBySlug = new Map<string, EvidenceItem[]>();
  for (const row of evidenceRows ?? []) {
    const bucket = evidenceBySlug.get(row.simulation_id) ?? [];
    bucket.push(row as EvidenceItem);
    evidenceBySlug.set(row.simulation_id, bucket);
  }

  const debriefBySlug = new Map<string, { id: string; is_visible: boolean }>();
  for (const d of debriefRows ?? []) {
    const raw = d.simulation_sessions as unknown;
    const sessions = (Array.isArray(raw) ? raw[0] : raw) as { simulation_slug: string } | null;
    const slug = sessions?.simulation_slug;
    if (slug) debriefBySlug.set(slug, { id: d.id, is_visible: d.is_visible });
  }

  const slugs = Array.from(disciplineBySlug.keys());
  const out: EditableSimulation[] = [];

  for (const slug of slugs) {
    const best = achievingResult(evalsBySlug.get(slug) ?? []);
    if (!best) continue;
    const vis = visibilityBySlug.get(slug);
    out.push({
      simulationSlug:  slug,
      title:           titleBySlug.get(slug) ?? slug,
      discipline:      disciplineBySlug.get(slug) ?? 'Unknown',
      highestBand:     best.verdict_band,
      achievedAt:      best.evaluated_at,
      // Defaults match getPortfolioBySlug.ts: ON / ON / OFF.
      showOnPortfolio: vis?.showOnPortfolio ?? true,
      showScores:      vis?.showScores      ?? true,
      showFeedback:    vis?.showFeedback     ?? false,
      evidence:        evidenceBySlug.get(slug) ?? [],
      debriefId:       debriefBySlug.get(slug)?.id ?? null,
      showDebrief:     debriefBySlug.get(slug)?.is_visible ?? true,
    });
  }

  out.sort((a, b) => (a.achievedAt < b.achievedAt ? 1 : -1));
  return out;
}

export default async function PortfolioEditPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('portfolio_profiles')
    .select('id, slug, headline, bio, location, linkedin_url, external_links, template')
    .eq('user_id', user.id)
    .maybeSingle();

  const editableSimulations = profile ? await loadEditableSimulations(user.id) : [];

  if (!profile) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: PAGE_BACKGROUND }}
      >
        <div className="max-w-xl w-full">
          <h1
            style={{
              fontFamily:   "'Fraunces', serif",
              fontSize:     'clamp(1.9rem, 4vw, 3rem)',
              fontWeight:   700,
              color:        NAVY,
              lineHeight:   1.15,
              marginBottom: '16px',
            }}
          >
            You don&apos;t have a portfolio yet
          </h1>

          <p
            style={{
              fontSize:  '15px',
              color:     '#7a7a7a',
              lineHeight: 1.8,
              maxWidth:  '520px',
              margin:    '0 auto 32px',
            }}
          >
            Complete a simulation to create your portfolio, then come back here to edit it.
          </p>

          <Link
            href="/simulations"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '8px',
              fontSize:       '13px',
              fontWeight:     600,
              color:          '#fff',
              background:     NAVY,
              padding:        '12px 26px',
              textDecoration: 'none',
              letterSpacing:  '0.06em',
            }}
          >
            Go to Simulations →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BACKGROUND }}>
      <style>{`
        .portfolio-back-link { transition: opacity 0.2s ease; }
        .portfolio-back-link:hover { opacity: 0.7; }
      `}</style>

      <main
        className="w-full mx-auto px-6"
        style={{
          maxWidth:      '720px',
          paddingTop:    '88px',
          paddingBottom: '120px',
        }}
      >
        <div style={{ marginBottom: '40px' }}>
          <Link
            href={`/portfolio/${profile.slug}`}
            className="portfolio-back-link"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '8px',
              fontSize:       '11px',
              fontWeight:     600,
              color:          TEAL,
              textDecoration: 'none',
              letterSpacing:  '0.12em',
              textTransform:  'uppercase',
            }}
          >
            <span>←</span>
            Back to Portfolio
          </Link>
        </div>

        <h1
          style={{
            fontFamily:   "'Fraunces', serif",
            fontSize:     'clamp(2rem, 5vw, 3rem)',
            fontWeight:   700,
            color:        NAVY,
            lineHeight:   1.1,
            marginBottom: '12px',
          }}
        >
          Edit Your Portfolio
        </h1>

        <p
          style={{
            fontSize:     '14px',
            color:        '#666',
            lineHeight:   1.6,
            marginBottom: '32px',
          }}
        >
          Your public portfolio is visible to recruiters and anyone with your link. Make it count.
        </p>

        <PortfolioEditPageContent
          initial={{
            slug:           profile.slug,
            template:       (profile.template as 'professional' | 'focused') ?? 'professional',
            headline:       profile.headline ?? '',
            bio:            profile.bio ?? '',
            location:       profile.location ?? '',
            linkedin_url:   profile.linkedin_url ?? '',
            external_links: Array.isArray(profile.external_links) ? profile.external_links : [],
            simulations:    editableSimulations,
          }}
        />
      </main>
    </div>
  );
}

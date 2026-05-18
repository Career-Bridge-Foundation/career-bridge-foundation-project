import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPortfolioBySlug } from '@/lib/portfolio/getPortfolioBySlug';
import { createClient } from '@/lib/supabase/server';
import { PortfolioHeader } from './PortfolioHeader';
import { SimulationCard } from './SimulationCard';
import { EditPortfolioButton } from './EditPortfolioButton';

const NAVY  = '#003359';
const TEAL  = '#4DC5D2';

// ── Metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPortfolioBySlug(slug);
  if (!data) return { title: 'Portfolio not found' };

  const { candidate, profile } = data;
  return {
    title: `${candidate.fullName} — Career Bridge Portfolio`,
    description:
      profile.headline ??
      `${candidate.fullName}'s verified Career Bridge portfolio`,
    openGraph: {
      title:       `${candidate.fullName} — Career Bridge Portfolio`,
      description: profile.headline ?? `${candidate.fullName}'s verified Career Bridge portfolio`,
      images:      [`/portfolio/${slug}/opengraph-image`],
    },
    twitter: {
      card:   'summary_large_image',
      title:  `${candidate.fullName} — Career Bridge Portfolio`,
      images: [`/portfolio/${slug}/opengraph-image`],
    },
  };
}

// ── Sub-components (server) ───────────────────────────────────────────

function StatsBar({
  stats,
}: {
  stats: { simulationCount: number; credentialCount: number; disciplineCount: number };
}) {
  const items = [
    { value: stats.simulationCount, label: 'Simulations' },
    { value: stats.credentialCount, label: 'Credentials' },
    { value: stats.disciplineCount, label: 'Disciplines' },
  ];

  return (
    <div
      className="flex flex-wrap gap-x-10 gap-y-4"
      style={{
        animation:      'portfolio-fade-up 0.5s ease both',
        animationDelay: '0.42s',
      }}
    >
      {items.map(({ value, label }) => (
        <div key={label} className="flex items-baseline gap-2">
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize:   '2.25rem',
              fontWeight: 700,
              color:      NAVY,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <span
            style={{
              fontSize:      '11px',
              fontWeight:    500,
              color:         '#aaa',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: '24px', height: '1px', background: TEAL, flexShrink: 0 }} />
      <span
        style={{
          fontSize:      '11px',
          fontWeight:    600,
          color:         TEAL,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPortfolioBySlug(slug);
  if (!data) notFound();

  const { profile, candidate, simulations, stats } = data;

  // Ownership detection — done separately so getPortfolioBySlug stays
  // privacy-gated and never exposes user_id in its return type. The query
  // is constrained to the viewer's own row so RLS allows it cleanly.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isOwner = false;
  if (user) {
    const { data: ownerRow } = await supabase
      .from('portfolio_profiles')
      .select('user_id')
      .eq('slug', slug)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    isOwner = !!ownerRow;
  }

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: `
          radial-gradient(ellipse at 75% 0%, rgba(77,197,210,0.07) 0%, transparent 55%),
          radial-gradient(ellipse at 10% 80%, rgba(0,51,89,0.04) 0%, transparent 50%),
          #FAFAFA
        `,
      }}
    >
      <style>{`
        .portfolio-back-link {
          transition: opacity 0.2s ease;
        }
        .portfolio-back-link:hover {
          opacity: 0.7;
        }
      `}</style>
      <main
        className="w-full mx-auto px-6"
        style={{
          maxWidth:      '720px',
          paddingTop:    '88px',
          paddingBottom: '120px',
        }}
      >

        {/* ── Back button + Edit button row ──────────────────────── */}
        <div
          style={{
            marginBottom:   '40px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            '12px',
            animation:      'portfolio-fade-up 0.5s ease both',
            animationDelay: '0.15s',
          }}
        >
          <Link
            href="/"
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
            Back to Home
          </Link>

          {/* <EditPortfolioButton isOwner={isOwner} /> */}
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        <PortfolioHeader profile={profile} candidate={candidate} />

        {/* ── Divider ────────────────────────────────────────────── */}
        <div
          style={{
            height:         '1px',
            background:     '#E5E9F0',
            margin:         '52px 0',
            animation:      'portfolio-fade-up 0.5s ease both',
            animationDelay: '0.38s',
          }}
        />

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <StatsBar stats={stats} />

        {/* ── Simulation cards ───────────────────────────────────── */}
        {/* When the simulations array is empty (no completed sims, or all
            hidden via portfolio_simulation_visibility), render nothing —
            no header, no fallback. */}
        {simulations.length > 0 && (
          <div style={{ marginTop: '56px' }}>
            <div
              style={{
                marginBottom:   '20px',
                animation:      'portfolio-fade-up 0.5s ease both',
                animationDelay: '0.52s',
              }}
            >
              <SectionLabel>Verified Simulations</SectionLabel>
            </div>

            <div className="flex flex-col" style={{ gap: '10px' }}>
              {simulations.map((sim, i) => (
                <SimulationCard
                  key={sim.simulationSlug}
                  sim={sim}
                  animationDelay={0.60 + i * 0.10}
                />
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="w-full text-center"
        style={{ paddingBottom: '40px' }}
      >
              <Link
                href="/"
          style={{
            fontSize:       '11px',
            color:          '#bbb',
            textDecoration: 'none',
            letterSpacing:  '0.06em',
          }}
        >
          Powered by Career Bridge Foundation
              </Link>
      </footer>

    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPortfolioBySlug } from '@/lib/portfolio/getPortfolioBySlug';
import { createClient } from '@/lib/supabase/server';
import { EditPortfolioButton } from './EditPortfolioButton';
import { TemplateRenderer } from './templates/TemplateRenderer';

const TEAL = '#4DC5D2';

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
    title: `${candidate.fullName} — Evidentize Portfolio`,
    description:
      profile.headline ??
      `${candidate.fullName}'s verified Evidentize portfolio`,
    openGraph: {
      title:       `${candidate.fullName} — Evidentize Portfolio`,
      description: profile.headline ?? `${candidate.fullName}'s verified Evidentize portfolio`,
      images:      [`/portfolio/${slug}/opengraph-image`],
    },
    twitter: {
      card:   'summary_large_image',
      title:  `${candidate.fullName} — Evidentize Portfolio`,
      images: [`/portfolio/${slug}/opengraph-image`],
    },
  };
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

          <EditPortfolioButton isOwner={isOwner} />
        </div>

        {/* ── Template-driven layout ─────────────────────────────── */}
        <TemplateRenderer data={data} />

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
          Powered by Evidentize
        </Link>
      </footer>

    </div>
  );
}

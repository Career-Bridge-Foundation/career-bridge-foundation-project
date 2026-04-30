import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

export default async function PortfolioLandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('portfolio_profiles')
      .select('slug')
      .eq('user_id', user.id)
      .eq('is_public', true)
      .maybeSingle();

    if (profile?.slug) {
      redirect(`/portfolio/${profile.slug}`);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{
        background: `
          radial-gradient(ellipse at 75% 0%, rgba(77,197,210,0.08) 0%, transparent 55%),
          radial-gradient(ellipse at 10% 80%, rgba(0,51,89,0.05) 0%, transparent 50%),
          #FAFAFA
        `,
      }}
    >
      <div className="max-w-xl w-full">
        <p
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: TEAL,
            textTransform: 'uppercase',
            marginBottom: '28px',
          }}
        >
          Career Bridge Portfolio
        </p>

        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(1.9rem, 4vw, 3rem)',
            fontWeight: 700,
            color: NAVY,
            lineHeight: 1.15,
            marginBottom: '16px',
          }}
        >
          You do not have a portfolio yet
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: '#7a7a7a',
            lineHeight: 1.8,
            maxWidth: '520px',
            margin: '0 auto 32px',
          }}
        >
          Your portfolio appears after you complete simulations and earn evaluated results.
          Start a simulation to build your first portfolio entry and make it publicly viewable.
        </p>

        <Link
          href="/simulations"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: NAVY,
            padding: '12px 26px',
            textDecoration: 'none',
            letterSpacing: '0.06em',
          }}
        >
          Go to Simulations →
        </Link>
      </div>
    </div>
  );
}
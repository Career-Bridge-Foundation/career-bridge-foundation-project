'use client';

import type { PortfolioData } from '@/lib/portfolio/getPortfolioBySlug';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

// Stagger constants (seconds)
const BASE_DELAY = 0;
const STEP       = 0.08;

function delay(step: number) {
  return `${BASE_DELAY + step * STEP}s`;
}

function fadeStyle(step: number): React.CSSProperties {
  return {
    animation:      'portfolio-fade-up 0.55s ease both',
    animationDelay: delay(step),
  };
}

type Props = {
  profile:   PortfolioData['profile'];
  candidate: PortfolioData['candidate'];
};

export function PortfolioHeader({ profile, candidate }: Props) {
  return (
    <>
      <style>{`
        @keyframes portfolio-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      <header className="w-full max-w-3xl mx-auto px-6 md:px-0">

        {/* Candidate name — Fraunces display font */}
        <h1
          style={{
            fontFamily:  "'Fraunces', serif",
            fontSize:    'clamp(2rem, 5vw, 3rem)',
            fontWeight:  700,
            color:       NAVY,
            lineHeight:  1.1,
            marginBottom: '12px',
            ...fadeStyle(0),
          }}
        >
          {candidate.fullName}
        </h1>

        {/* Headline */}
        {profile.headline && (
          <p
            style={{
              fontSize:    '18px',
              fontWeight:  400,
              color:       '#444',
              lineHeight:  1.5,
              marginBottom: '16px',
              ...fadeStyle(1),
            }}
          >
            {profile.headline}
          </p>
        )}

        {/* Location */}
        {profile.location && (
          <p
            style={{
              fontSize:    '13px',
              color:       '#888',
              marginBottom: '20px',
              display:     'flex',
              alignItems:  'center',
              gap:         '5px',
              ...fadeStyle(2),
            }}
          >
            <span>📍</span>
            {profile.location}
          </p>
        )}

        {/* Bio */}
        {profile.bio && (
          <p
            style={{
              fontSize:    '15px',
              color:       '#555',
              lineHeight:  1.8,
              maxWidth:    '600px',
              marginBottom: '24px',
              ...fadeStyle(3),
            }}
          >
            {profile.bio}
          </p>
        )}

        {/* Links row — LinkedIn + external links */}
        {(profile.linkedin_url || profile.external_links.length > 0) && (
          <div
            style={{
              display:   'flex',
              flexWrap:  'wrap',
              gap:       '10px',
              ...fadeStyle(4),
            }}
          >
            {profile.linkedin_url && (
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize:       '12px',
                  fontWeight:     600,
                  color:          '#fff',
                  background:     '#0A66C2',
                  padding:        '5px 12px',
                  textDecoration: 'none',
                  letterSpacing:  '0.04em',
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '5px',
                  whiteSpace:     'nowrap',
                }}
              >
                <span>in</span> LinkedIn
              </a>
            )}

            {profile.external_links.slice(0, 6).map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize:       '12px',
                  fontWeight:     500,
                  color:          NAVY,
                  border:         `1px solid #D5DCE8`,
                  padding:        '5px 12px',
                  textDecoration: 'none',
                  background:     '#fff',
                  whiteSpace:     'nowrap',
                }}
              >
                🔗 {link.label}
              </a>
            ))}
          </div>
        )}

      </header>
    </>
  );
}

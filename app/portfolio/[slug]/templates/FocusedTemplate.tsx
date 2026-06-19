import type { PortfolioData } from '@/lib/portfolio/getPortfolioBySlug';
import { SimulationCard } from '../SimulationCard';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

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

type Props = {
  data: PortfolioData;
};

export function FocusedTemplate({ data }: Props) {
  const { profile, candidate, simulations, stats } = data;

  const credentialCount = stats.credentialCount;
  const disciplineCount = stats.disciplineCount;

  return (
    <>
      {/* ── Compact header: name + headline + location only ────── */}
      <header style={{ marginBottom: '36px' }}>
        <h1
          style={{
            fontFamily:   "'Fraunces', serif",
            fontSize:     'clamp(2rem, 5vw, 3rem)',
            fontWeight:   700,
            color:        NAVY,
            lineHeight:   1.1,
            marginBottom: '10px',
            animation:    'portfolio-fade-up 0.55s ease both',
            animationDelay: '0s',
          }}
        >
          {candidate.fullName}
        </h1>

        {profile.headline && (
          <p
            style={{
              fontSize:     '17px',
              fontWeight:   400,
              color:        '#444',
              lineHeight:   1.5,
              marginBottom: profile.location ? '8px' : '0',
              animation:    'portfolio-fade-up 0.55s ease both',
              animationDelay: '0.08s',
            }}
          >
            {profile.headline}
          </p>
        )}

        {profile.location && (
          <p
            style={{
              fontSize:   '13px',
              color:      '#888',
              display:    'flex',
              alignItems: 'center',
              gap:        '5px',
              animation:  'portfolio-fade-up 0.55s ease both',
              animationDelay: '0.16s',
            }}
          >
            <span>📍</span>
            {profile.location}
          </p>
        )}
      </header>

      {/* ── Credential summary strip ────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '24px',
          padding:        '14px 20px',
          background:     NAVY,
          marginBottom:   '40px',
          animation:      'portfolio-fade-up 0.5s ease both',
          animationDelay: '0.22s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize:   '1.75rem',
              fontWeight: 700,
              color:      '#fff',
              lineHeight: 1,
            }}
          >
            {credentialCount}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: TEAL, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Credential{credentialCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize:   '1.75rem',
              fontWeight: 700,
              color:      '#fff',
              lineHeight: 1,
            }}
          >
            {stats.simulationCount}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: TEAL, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Simulation{stats.simulationCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize:   '1.75rem',
              fontWeight: 700,
              color:      '#fff',
              lineHeight: 1,
            }}
          >
            {disciplineCount}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: TEAL, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {disciplineCount === 1 ? 'Discipline' : 'Disciplines'}
          </span>
        </div>
      </div>

      {/* ── Simulation cards — lead section ────────────────────── */}
      {simulations.length > 0 && (
        <div>
          <div style={{ marginBottom: '20px', animation: 'portfolio-fade-up 0.5s ease both', animationDelay: '0.30s' }}>
            <SectionLabel>Verified Simulations</SectionLabel>
          </div>

          <div className="flex flex-col" style={{ gap: '10px' }}>
            {simulations.map((sim, i) => (
              <SimulationCard
                key={sim.simulationSlug}
                sim={sim}
                animationDelay={0.38 + i * 0.10}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── About section — bio + links at the bottom ──────────── */}
      {(profile.bio || profile.linkedin_url || profile.external_links.length > 0) && (
        <div
          style={{
            marginTop:  '56px',
            paddingTop: '40px',
            borderTop:  '1px solid #E5E9F0',
            animation:  'portfolio-fade-up 0.5s ease both',
            animationDelay: `${0.38 + simulations.length * 0.10}s`,
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <SectionLabel>About</SectionLabel>
          </div>

          {profile.bio && (
            <p
              style={{
                fontSize:     '15px',
                color:        '#555',
                lineHeight:   1.8,
                maxWidth:     '600px',
                marginBottom: '20px',
              }}
            >
              {profile.bio}
            </p>
          )}

          {(profile.linkedin_url || profile.external_links.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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

              {profile.external_links.slice(0, 6).map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize:       '12px',
                    fontWeight:     500,
                    color:          NAVY,
                    border:         '1px solid #D5DCE8',
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
        </div>
      )}
    </>
  );
}

import type { PortfolioData } from '@/lib/portfolio/getPortfolioBySlug';
import { PortfolioHeader } from '../PortfolioHeader';
import { SimulationCard } from '../SimulationCard';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

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
      style={{ animation: 'portfolio-fade-up 0.5s ease both', animationDelay: '0.42s' }}
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

type Props = {
  data: PortfolioData;
};

export function ProfessionalTemplate({ data }: Props) {
  const { profile, candidate, simulations, stats } = data;

  return (
    <>
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
    </>
  );
}

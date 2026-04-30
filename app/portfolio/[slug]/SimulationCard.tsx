import { VerdictChip } from './VerdictChip';
import { ExpandableDetails } from './ExpandableDetails';
import type { SimulationOnPortfolio } from '@/lib/portfolio/getPortfolioBySlug';

const NAVY   = '#003359';
const TEAL   = '#4DC5D2';
const BORDER = '#D5DCE8';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function SimulationCard({
  sim,
  animationDelay = 0,
}: {
  sim: SimulationOnPortfolio;
  animationDelay?: number;
}) {
  return (
    <div
      style={{
        border:         `1px solid ${BORDER}`,
        background:     '#fff',
        animation:      'portfolio-fade-up 0.5s ease both',
        animationDelay: `${animationDelay}s`,
      }}
    >
      {/* ── Static header — server-rendered ── */}
      <div className="px-6 py-5 flex flex-col gap-3">

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <VerdictChip band={sim.highestBand} />

          {sim.credentialStatus === 'issued' && sim.credentialUrl && (
            <a
              href={sim.credentialUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize:       '11px',
                fontWeight:     600,
                color:          TEAL,
                border:         `1px solid ${TEAL}`,
                padding:        '3px 10px',
                textDecoration: 'none',
                letterSpacing:  '0.06em',
                whiteSpace:     'nowrap',
              }}
            >
              View Credential ↗
            </a>
          )}
        </div>

        <div>
          <p style={{ fontWeight: 700, color: NAVY, fontSize: '16px', marginBottom: '3px' }}>
            {sim.title}
          </p>
          <p style={{ fontSize: '12px', color: '#888', letterSpacing: '0.04em' }}>
            {sim.discipline} · Achieved {formatDate(sim.achievedAt)}
          </p>
        </div>

      </div>

      {/* ── Expandable section — client island ── */}
      <ExpandableDetails sim={sim} />
    </div>
  );
}

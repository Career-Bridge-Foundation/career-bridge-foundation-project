'use client';

import { useState } from 'react';
import type { SimulationOnPortfolio, EvidenceItem } from '@/lib/portfolio/getPortfolioBySlug';

const NAVY   = '#003359';
const BORDER = '#D5DCE8';

function EvidenceThumb({ item }: { item: EvidenceItem }) {
  const href = item.external_url ?? item.file_url ?? '#';

  const icon =
    item.evidence_type === 'link'     ? '🔗' :
    item.evidence_type === 'pdf'      ? '📄' :
    item.evidence_type === 'image'    ? null  : '📎';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={item.title}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '8px',
        padding:        '8px 12px',
        border:         `1px solid ${BORDER}`,
        background:     '#FAFAFA',
        textDecoration: 'none',
        maxWidth:       '200px',
        flex:           '0 0 auto',
      }}
    >
      {item.evidence_type === 'image' && item.file_url ? (
        <img
          src={item.file_url}
          alt={item.title}
          style={{ width: '36px', height: '36px', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
      )}
      <span
        style={{
          fontSize:     '11px',
          color:        NAVY,
          fontWeight:   500,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}
      >
        {item.title}
      </span>
    </a>
  );
}

export function ExpandableDetails({ sim }: { sim: SimulationOnPortfolio }) {
  const [open, setOpen] = useState(false);

  const hasExpandable =
    (sim.showScores  && sim.overallScore !== null) ||
    (sim.showFeedback && !!sim.feedbackText)        ||
    sim.evidence.length > 0;

  if (!hasExpandable) return null;

  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '4px',
          padding:       '10px 24px',
          fontSize:      '11px',
          fontWeight:    500,
          color:         '#888',
          background:    'none',
          border:        'none',
          cursor:        'pointer',
          letterSpacing: '0.04em',
          width:         '100%',
          textAlign:     'left',
        }}
      >
        {open ? 'Hide details ↑' : 'Show details ↓'}
      </button>

      {/* Expandable body */}
      {open && (
        <div
          className="px-6 pb-6 flex flex-col gap-5"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          {/* Score */}
          {sim.showScores && sim.overallScore !== null && (
            <div className="pt-5">
              <p style={{ fontSize: '11px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Capability Score
              </p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: NAVY }}>
                {sim.overallScore}
                <span style={{ fontSize: '14px', fontWeight: 400, color: '#aaa' }}> / 45</span>
              </p>
            </div>
          )}

          {/* Feedback */}
          {sim.showFeedback && sim.feedbackText && (
            <div>
              <p style={{ fontSize: '11px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Assessment Feedback
              </p>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.75 }}>
                {sim.feedbackText}
              </p>
            </div>
          )}

          {/* Evidence */}
          {sim.evidence.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Evidence
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {sim.evidence.map(item => (
                  <EvidenceThumb key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

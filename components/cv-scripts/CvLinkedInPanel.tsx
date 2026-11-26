'use client';

import { VerdictChip } from '@/app/portfolio/[slug]/VerdictChip';
import { CopyButton } from './CopyButton';

const NAVY = '#003359';

type LinkedInProject = { title: string; description: string; url: string };

export type CvScriptFormats = {
  cv_bullet?: string;
  cv_summary?: string;
  linkedin_project?: LinkedInProject;
  linkedin_about?: string;
};

export type CvScriptRow = {
  id: string;
  scope: 'simulation' | 'discipline_summary';
  simulation_slug: string | null;
  discipline: string;
  verdict_band: string | null;
  completed_count: number | null;
  formats: CvScriptFormats;
};

type Props = {
  scripts: CvScriptRow[];
  simulationTitles: Record<string, string>;
};

const cardStyle: React.CSSProperties = {
  border:       '1px solid #E5E9F0',
  borderRadius: '4px',
  background:   '#fff',
  padding:      '16px 18px',
  display:      'flex',
  flexDirection: 'column',
  gap:          '10px',
};

const rowHeaderStyle: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  gap:            '12px',
  flexWrap:       'wrap',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize:   '13px',
  color:      '#3A3A3A',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
};

function DisciplineGroup({
  discipline,
  bullets,
  summary,
  titleFor,
}: {
  discipline: string;
  bullets: CvScriptRow[];
  summary: CvScriptRow | undefined;
  titleFor: (slug: string | null) => string;
}) {
  const completedCount = summary?.completed_count ?? bullets[0]?.completed_count ?? bullets.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          fontSize:      '11px',
          fontWeight:    700,
          color:         NAVY,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {discipline}
      </div>

      {bullets.map((row) => (
        <div key={row.id} style={cardStyle}>
          <div style={rowHeaderStyle}>
            <span style={{ fontSize: '12px', color: '#888' }}>{titleFor(row.simulation_slug)}</span>
            {row.verdict_band && <VerdictChip band={row.verdict_band} size="sm" />}
          </div>
          <p style={bodyTextStyle}>{row.formats.cv_bullet}</p>
          {row.formats.cv_bullet && <div><CopyButton text={row.formats.cv_bullet} label="Copy bullet" /></div>}
        </div>
      ))}

      {summary ? (
        <>
          <div style={cardStyle}>
            <div style={rowHeaderStyle}>
              <span style={{ fontSize: '12px', color: '#888' }}>Discipline summary · {completedCount} completed</span>
            </div>
            <p style={bodyTextStyle}>{summary.formats.cv_summary}</p>
            {summary.formats.cv_summary && <div><CopyButton text={summary.formats.cv_summary} label="Copy summary" /></div>}
          </div>

          {summary.formats.linkedin_project && (
            <div style={cardStyle}>
              <div style={{ fontSize: '12px', color: '#888' }}>LinkedIn — Projects entry</div>
              <div style={{ fontSize: '13px', color: '#3A3A3A' }}>
                <strong>Title:</strong> {summary.formats.linkedin_project.title}
              </div>
              <p style={bodyTextStyle}>{summary.formats.linkedin_project.description}</p>
              <div style={{ fontSize: '13px', color: '#3A3A3A' }}>
                <strong>URL:</strong> {summary.formats.linkedin_project.url}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <CopyButton text={summary.formats.linkedin_project.title} label="Copy title" />
                <CopyButton text={summary.formats.linkedin_project.description} label="Copy description" />
                <CopyButton text={summary.formats.linkedin_project.url} label="Copy URL" />
              </div>
            </div>
          )}

          {summary.formats.linkedin_about && (
            <div style={cardStyle}>
              <div style={{ fontSize: '12px', color: '#888' }}>LinkedIn — About</div>
              <p style={bodyTextStyle}>{summary.formats.linkedin_about}</p>
              <div><CopyButton text={summary.formats.linkedin_about} label="Copy about" /></div>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
          Your LinkedIn Projects entry and About line unlock after a second assessed pass in {discipline}.
        </p>
      )}
    </div>
  );
}

export function CvLinkedInPanel({ scripts, simulationTitles }: Props) {
  if (scripts.length === 0) return null;

  const byDiscipline = new Map<string, { bullets: CvScriptRow[]; summary?: CvScriptRow }>();
  for (const row of scripts) {
    const bucket = byDiscipline.get(row.discipline) ?? { bullets: [] };
    if (row.scope === 'simulation') bucket.bullets.push(row);
    else bucket.summary = row;
    byDiscipline.set(row.discipline, bucket);
  }

  const titleFor = (slug: string | null) => (slug ? simulationTitles[slug] ?? slug : 'Simulation');

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
        CV &amp; LinkedIn
      </div>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', lineHeight: 1.5 }}>
        Add CV text under its own heading — such as <em>Verified Simulations</em> — kept separate from your Work Experience.
        These are generated once from your verified results and won&apos;t change unless a retake improves your band.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {Array.from(byDiscipline.entries()).map(([discipline, group]) => (
          <DisciplineGroup
            key={discipline}
            discipline={discipline}
            bullets={group.bullets}
            summary={group.summary}
            titleFor={titleFor}
          />
        ))}
      </div>
    </div>
  );
}

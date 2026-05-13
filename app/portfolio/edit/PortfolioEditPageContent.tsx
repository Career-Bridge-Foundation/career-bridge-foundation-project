'use client';

import { useState, useEffect, useRef } from 'react';
import { VerdictChip } from '../[slug]/VerdictChip';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

const HEADLINE_MAX = 120;
const BIO_MAX      = 500;
const LOCATION_MAX = 80;
const LINK_LABEL_MAX = 30;
const MAX_LINKS = 6;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ExternalLink = { label: string; url: string };

export type EditableSimulation = {
  simulationSlug:   string;
  title:            string;
  discipline:       string;
  highestBand:      string;
  achievedAt:       string;
  showOnPortfolio:  boolean;
  showScores:       boolean;
  showFeedback:     boolean;
};

type Props = {
  initial: {
    headline:       string;
    bio:            string;
    location:       string;
    linkedin_url:   string;
    external_links: ExternalLink[];
    simulations:    EditableSimulation[];
  };
};

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const labelStyle: React.CSSProperties = {
  display:        'block',
  fontSize:       '11px',
  color:          '#666',
  fontWeight:     600,
  marginBottom:   '8px',
  textTransform:  'uppercase',
  letterSpacing:  '0.1em',
};

const fieldStyle: React.CSSProperties = {
  width:        '100%',
  border:       '1px solid #D5DCE8',
  borderRadius: 0,
  padding:      '12px 14px',
  fontSize:     '14px',
  fontFamily:   'inherit',
  background:   '#fff',
  color:        '#222',
  outline:      'none',
  boxSizing:    'border-box',
};

const linkInputStyle: React.CSSProperties = {
  ...fieldStyle,
  padding: '10px 12px',
};

function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(url.trim());
}

export function PortfolioEditPageContent({ initial }: Props) {
  const [headline,    setHeadline]    = useState(initial.headline);
  const [bio,         setBio]         = useState(initial.bio);
  const [location,    setLocation]    = useState(initial.location);
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedin_url);
  const [links,       setLinks]       = useState<ExternalLink[]>(initial.external_links);
  const [simulations, setSimulations] = useState<EditableSimulation[]>(initial.simulations);

  function updateSimulation(slug: string, patch: Partial<EditableSimulation>) {
    setSimulations((prev) =>
      prev.map((s) => (s.simulationSlug === slug ? { ...s, ...patch } : s))
    );
  }

  const [saveState,    setSaveState]    = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkErrors,   setLinkErrors]   = useState<Record<number, { label?: string; url?: string }>>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function updateLink(index: number, patch: Partial<ExternalLink>) {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, ...patch } : link)));
    setLinkErrors((prev) => {
      if (!prev[index]) return prev;
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
    setLinkErrors({}); // indices shift; clearest is to drop and re-validate on save
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks((prev) => [...prev, { label: '', url: '' }]);
  }

  function validateLinks(): { ok: boolean; cleaned: ExternalLink[] } {
    const errors: Record<number, { label?: string; url?: string }> = {};
    const cleaned: ExternalLink[] = [];

    links.forEach((link, i) => {
      const labelTrim = link.label.trim();
      const urlTrim   = link.url.trim();

      // Silently drop fully blank rows
      if (!labelTrim && !urlTrim) return;

      const rowErrors: { label?: string; url?: string } = {};
      if (!labelTrim) rowErrors.label = 'Label is required';
      else if (labelTrim.length > LINK_LABEL_MAX) rowErrors.label = `Max ${LINK_LABEL_MAX} characters`;

      if (!urlTrim) rowErrors.url = 'URL is required';
      else if (!isValidUrl(urlTrim)) rowErrors.url = 'Must start with http:// or https://';

      if (rowErrors.label || rowErrors.url) {
        errors[i] = rowErrors;
      } else {
        cleaned.push({ label: labelTrim, url: urlTrim });
      }
    });

    setLinkErrors(errors);
    return { ok: Object.keys(errors).length === 0, cleaned };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const { ok, cleaned } = validateLinks();
    if (!ok) {
      setSaveState('error');
      setErrorMessage('Please fix the link errors below.');
      return;
    }

    setSaveState('saving');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/portfolio/edit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline:       headline.trim()    || null,
          bio:            bio.trim()         || null,
          location:       location.trim()    || null,
          linkedin_url:   linkedinUrl.trim() || null,
          external_links: cleaned,
          simulation_visibility: simulations.map((s) => ({
            simulation_id: s.simulationSlug,
            show_on_portfolio: s.showOnPortfolio,
            show_scores:       s.showScores,
            show_feedback:     s.showFeedback,
          })),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        setSaveState('error');
        setErrorMessage(json.error ?? `Save failed (${res.status})`);
        return;
      }

      setSaveState('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error');
    }
  }

  const buttonLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved'  ? '✓ Saved' :
    'Save';

  const addDisabled = links.length >= MAX_LINKS;

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <style>{`
        .pf-input:focus, .pf-textarea:focus { border-color: ${NAVY} !important; }
        .pf-link-remove { color: #999; transition: color 0.15s ease; }
        .pf-link-remove:hover:not(:disabled) { color: #c33; }
        .pf-add-link { transition: opacity 0.15s ease; }
        .pf-add-link:hover:not(:disabled) { opacity: 0.75; }
      `}</style>

      {/* ── Headline ─────────────────────────────────────────── */}
      <div>
        <label htmlFor="pf-headline" style={labelStyle}>Headline</label>
        <input
          id="pf-headline"
          className="pf-input"
          type="text"
          value={headline}
          maxLength={HEADLINE_MAX}
          placeholder="Senior Product Manager · Fintech"
          onChange={(e) => setHeadline(e.target.value)}
          style={fieldStyle}
        />
      </div>

      {/* ── Location ─────────────────────────────────────────── */}
      <div>
        <label htmlFor="pf-location" style={labelStyle}>Location</label>
        <input
          id="pf-location"
          className="pf-input"
          type="text"
          value={location}
          maxLength={LOCATION_MAX}
          placeholder="London, UK"
          onChange={(e) => setLocation(e.target.value)}
          style={fieldStyle}
        />
      </div>

      {/* ── Bio ──────────────────────────────────────────────── */}
      <div>
        <label htmlFor="pf-bio" style={labelStyle}>Bio</label>
        <textarea
          id="pf-bio"
          className="pf-textarea"
          value={bio}
          maxLength={BIO_MAX}
          onChange={(e) => setBio(e.target.value)}
          style={{
            ...fieldStyle,
            minHeight: '120px',
            resize:    'vertical',
            lineHeight: 1.6,
          }}
        />
        <div
          style={{
            fontSize:    '11px',
            color:       '#888',
            marginTop:   '6px',
            textAlign:   'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {bio.length} / {BIO_MAX}
        </div>
      </div>

      {/* ── LinkedIn URL ─────────────────────────────────────── */}
      <div>
        <label htmlFor="pf-linkedin" style={labelStyle}>LinkedIn URL</label>
        <input
          id="pf-linkedin"
          className="pf-input"
          type="url"
          value={linkedinUrl}
          placeholder="https://linkedin.com/in/yourname"
          pattern="https?://.+"
          onChange={(e) => setLinkedinUrl(e.target.value)}
          style={fieldStyle}
        />
      </div>

      {/* ── External Links ───────────────────────────────────── */}
      <div>
        <div style={labelStyle}>External Links</div>
        <p
          style={{
            fontSize:     '12px',
            color:        '#888',
            marginBottom: '16px',
            lineHeight:   1.5,
          }}
        >
          Add up to 6 links to your other profiles, work, or social media. LinkedIn is already above.
        </p>

        {links.length === 0 ? (
          <p
            style={{
              fontSize:     '13px',
              color:        '#999',
              marginBottom: '12px',
            }}
          >
            No external links yet. Click &apos;Add link&apos; to share other profiles.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {links.map((link, i) => {
              const rowErr = linkErrors[i] ?? {};
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: '0 0 30%', minWidth: 0 }}>
                      <input
                        className="pf-input"
                        type="text"
                        value={link.label}
                        maxLength={LINK_LABEL_MAX}
                        placeholder="YouTube"
                        onChange={(e) => updateLink(i, { label: e.target.value })}
                        style={linkInputStyle}
                        aria-label={`Link ${i + 1} label`}
                      />
                    </div>
                    <div style={{ flex: '1 1 60%', minWidth: 0 }}>
                      <input
                        className="pf-input"
                        type="url"
                        value={link.url}
                        placeholder="https://youtube.com/@yourchannel"
                        pattern="https?://.+"
                        onChange={(e) => updateLink(i, { url: e.target.value })}
                        style={linkInputStyle}
                        aria-label={`Link ${i + 1} URL`}
                      />
                    </div>
                    <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="pf-link-remove"
                        onClick={() => removeLink(i)}
                        aria-label={`Remove link ${i + 1}`}
                        style={{
                          background:   'transparent',
                          border:       'none',
                          padding:      '6px 10px',
                          fontSize:     '20px',
                          lineHeight:   1,
                          cursor:       'pointer',
                          fontFamily:   'inherit',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Row footer: label counter + per-field errors */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: '0 0 30%', minWidth: 0 }}>
                      {rowErr.label ? (
                        <p style={{ fontSize: '12px', color: '#c33', marginTop: '2px' }}>{rowErr.label}</p>
                      ) : (
                        <p
                          style={{
                            fontSize: '11px',
                            color: '#999',
                            marginTop: '2px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {link.label.length} / {LINK_LABEL_MAX}
                        </p>
                      )}
                    </div>
                    <div style={{ flex: '1 1 60%', minWidth: 0 }}>
                      {rowErr.url && (
                        <p style={{ fontSize: '12px', color: '#c33', marginTop: '2px' }}>{rowErr.url}</p>
                      )}
                    </div>
                    <div style={{ flex: '0 0 auto', width: '40px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="pf-add-link"
          onClick={addLink}
          disabled={addDisabled}
          style={{
            background:    'transparent',
            border:        'none',
            padding:       '8px 0',
            marginTop:     links.length === 0 ? '0' : '4px',
            fontSize:      '13px',
            fontWeight:    500,
            color:         addDisabled ? '#aaa' : TEAL,
            cursor:        addDisabled ? 'not-allowed' : 'pointer',
            fontFamily:    'inherit',
          }}
        >
          + Add link
        </button>
      </div>

      {/* ── Verified Simulations (visibility) ────────────────── */}
      <div>
        <div style={labelStyle}>Verified Simulations</div>
        <p
          style={{
            fontSize:     '12px',
            color:        '#888',
            marginBottom: '16px',
            lineHeight:   1.5,
          }}
        >
          Control what recruiters see for each simulation. Changes save when you click Save below.
        </p>

        {simulations.length === 0 ? (
          <p
            style={{
              fontSize: '13px',
              color:    '#999',
              padding:  '20px 0',
            }}
          >
            Complete a simulation to see it here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {simulations.map((sim) => (
              <SimulationVisibilityRow
                key={sim.simulationSlug}
                sim={sim}
                onChange={(patch) => updateSimulation(sim.simulationSlug, patch)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Save button ──────────────────────────────────────── */}
      <div style={{ marginTop: '4px' }}>
        <button
          type="submit"
          disabled={saveState === 'saving'}
          style={{
            background:    NAVY,
            color:         '#fff',
            border:        'none',
            borderRadius:  0,
            padding:       '12px 32px',
            fontSize:      '13px',
            fontWeight:    600,
            letterSpacing: '0.06em',
            cursor:        saveState === 'saving' ? 'not-allowed' : 'pointer',
            opacity:       saveState === 'saving' ? 0.7 : 1,
            fontFamily:    'inherit',
          }}
        >
          {buttonLabel}
        </button>

        {saveState === 'error' && errorMessage && (
          <p
            style={{
              marginTop: '12px',
              fontSize:  '13px',
              color:     '#c0392b',
            }}
          >
            {errorMessage}
          </p>
        )}
      </div>
    </form>
  );
}

function SimulationVisibilityRow({
  sim,
  onChange,
}: {
  sim:      EditableSimulation;
  onChange: (patch: Partial<EditableSimulation>) => void;
}) {
  const toggleStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '12px',
    fontSize:       '13px',
    color:          '#333',
    cursor:         'pointer',
    userSelect:     'none',
  };

  return (
    <div
      style={{
        border:     '1px solid #D5DCE8',
        background: '#fff',
        padding:    '16px 18px',
        display:    'flex',
        flexWrap:   'wrap',
        gap:        '20px',
        alignItems: 'flex-start',
      }}
    >
      {/* Left: simulation info */}
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <p
          style={{
            fontSize:     '15px',
            fontWeight:   600,
            color:        NAVY,
            marginBottom: '4px',
            lineHeight:   1.3,
          }}
        >
          {sim.title}
        </p>
        <p
          style={{
            fontSize:     '13px',
            color:        '#666',
            marginBottom: '8px',
          }}
        >
          {sim.discipline} · {formatMonthYear(sim.achievedAt)}
        </p>
        <VerdictChip band={sim.highestBand} size="sm" />
      </div>

      {/* Right: three toggles */}
      <div
        style={{
          flex:           '0 1 220px',
          display:        'flex',
          flexDirection:  'column',
          gap:            '8px',
          minWidth:       '180px',
        }}
      >
        <label style={toggleStyle}>
          <span>Show on portfolio</span>
          <input
            type="checkbox"
            checked={sim.showOnPortfolio}
            onChange={(e) => onChange({ showOnPortfolio: e.target.checked })}
          />
        </label>
        <label style={{ ...toggleStyle, opacity: sim.showOnPortfolio ? 1 : 0.5 }}>
          <span>Show score</span>
          <input
            type="checkbox"
            checked={sim.showScores}
            disabled={!sim.showOnPortfolio}
            onChange={(e) => onChange({ showScores: e.target.checked })}
          />
        </label>
        <label style={{ ...toggleStyle, opacity: sim.showOnPortfolio ? 1 : 0.5 }}>
          <span>Show feedback</span>
          <input
            type="checkbox"
            checked={sim.showFeedback}
            disabled={!sim.showOnPortfolio}
            onChange={(e) => onChange({ showFeedback: e.target.checked })}
          />
        </label>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { VerdictChip } from '../[slug]/VerdictChip';
import { CvLinkedInPanel, type CvScriptRow } from '@/components/cv-scripts/CvLinkedInPanel';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

const HEADLINE_MAX = 120;
const BIO_MAX      = 500;
const LOCATION_MAX = 80;
const LINK_LABEL_MAX = 30;
const MAX_LINKS = 6;

const EVIDENCE_TITLE_MAX       = 100;
const EVIDENCE_DESCRIPTION_MAX = 300;
const MAX_EVIDENCE             = 5;
const DELETE_CONFIRM_WINDOW_MS = 3000;

const EVIDENCE_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

type EvidenceType = 'image' | 'pdf' | 'document' | 'link';

export type EvidenceItem = {
  id:            string;
  simulation_id: string;
  session_id:    string | null;
  title:         string;
  description:   string | null;
  evidence_type: EvidenceType;
  file_url:      string | null;
  external_url:  string | null;
  is_visible:    boolean;
  sort_order:    number;
  uploaded_at:   string;
};

const EVIDENCE_TYPE_ICON: Record<EvidenceType, string> = {
  image:    '🖼',
  pdf:      '📄',
  document: '📋',
  link:     '🔗',
};

type SaveState = 'idle' | 'saving' | 'error';

type ExternalLink = { label: string; url: string };

type PortfolioTemplate = 'professional' | 'focused';

const TEMPLATE_OPTIONS: { value: PortfolioTemplate; label: string; description: string }[] = [
  {
    value:       'professional',
    label:       'Professional',
    description: 'Full profile with bio and links first, followed by your verified simulations.',
  },
  {
    value:       'focused',
    label:       'Focused',
    description: 'Credentials lead. Your verified simulations are shown first, with bio and links below.',
  },
];

export type EditableSimulation = {
  simulationSlug:   string;
  title:            string;
  discipline:       string;
  highestBand:      string;
  achievedAt:       string;
  showOnPortfolio:  boolean;
  showScores:       boolean;
  showFeedback:     boolean;
  evidence:         EvidenceItem[];
  debriefId:        string | null;
  showDebrief:      boolean;
};

type Props = {
  initial: {
    headline:       string;
    bio:            string;
    location:       string;
    linkedin_url:   string;
    external_links: ExternalLink[];
    simulations:    EditableSimulation[];
    template:       PortfolioTemplate;
    slug:           string;
    cvScripts:        CvScriptRow[];
    simulationTitles: Record<string, string>;
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
  const router = useRouter();

  const [template,    setTemplate]    = useState<PortfolioTemplate>(initial.template);
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
  const [previewTemplate, setPreviewTemplate] = useState<PortfolioTemplate | null>(null);
  const [modalSaving,     setModalSaving]     = useState(false);
  const [modalError,      setModalError]      = useState<string | null>(null);

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
          template,
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

      router.push(`/portfolio/${initial.slug}`);
    } catch (err) {
      setSaveState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Network error');
    }
  }

  async function handleApplyTemplate(selected: PortfolioTemplate) {
    const { ok, cleaned } = validateLinks();
    if (!ok) {
      setModalError('Fix link errors in the form before applying a layout.');
      return;
    }

    setModalSaving(true);
    setModalError(null);

    try {
      const res = await fetch('/api/portfolio/edit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template:       selected,
          headline:       headline.trim()    || null,
          bio:            bio.trim()         || null,
          location:       location.trim()    || null,
          linkedin_url:   linkedinUrl.trim() || null,
          external_links: cleaned,
          simulation_visibility: simulations.map((s) => ({
            simulation_id:     s.simulationSlug,
            show_on_portfolio: s.showOnPortfolio,
            show_scores:       s.showScores,
            show_feedback:     s.showFeedback,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !(data as { success?: boolean }).success) {
        setModalSaving(false);
        setModalError((data as { error?: string }).error ?? `Save failed (${res.status})`);
        return;
      }

      setTemplate(selected);
      router.push(`/portfolio/${initial.slug}`);
    } catch (err) {
      setModalSaving(false);
      setModalError(err instanceof Error ? err.message : 'Network error');
    }
  }

  const buttonLabel = saveState === 'saving' ? 'Saving…' : 'Save';

  const addDisabled = links.length >= MAX_LINKS;

  return (
    <>
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <style>{`
        .pf-input:focus, .pf-textarea:focus { border-color: ${NAVY} !important; }
        .pf-link-remove { color: #999; transition: color 0.15s ease; }
        .pf-link-remove:hover:not(:disabled) { color: #c33; }
        .pf-add-link { transition: opacity 0.15s ease; }
        .pf-add-link:hover:not(:disabled) { opacity: 0.75; }
        .pf-evidence-header:hover { color: ${NAVY} !important; }
        .pf-add-evidence:hover:not(:disabled) { background: #F0FBFC !important; }
      `}</style>

      {/* ── Portfolio Layout ─────────────────────────────────── */}
      <div>
        <div style={labelStyle}>Portfolio Layout</div>
        <p
          style={{
            fontSize:     '12px',
            color:        '#888',
            marginBottom: '16px',
            lineHeight:   1.5,
          }}
        >
          Choose how your portfolio presents to recruiters.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {TEMPLATE_OPTIONS.map((opt) => {
            const selected = template === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreviewTemplate(opt.value)}
                style={{
                  flex:        '1 1 200px',
                  textAlign:   'left',
                  border:      `2px solid ${selected ? NAVY : '#D5DCE8'}`,
                  background:  selected ? '#EEF3F8' : '#fff',
                  padding:     '16px',
                  cursor:      'pointer',
                  fontFamily:  'inherit',
                  position:    'relative',
                  transition:  'border-color 0.15s ease, background 0.15s ease',
                }}
                aria-pressed={selected}
              >
                {selected && (
                  <span
                    style={{
                      position:   'absolute',
                      top:        '10px',
                      right:      '12px',
                      color:      NAVY,
                      fontWeight: 700,
                      fontSize:   '14px',
                    }}
                  >
                    ✓
                  </span>
                )}
                <div
                  style={{
                    fontSize:     '14px',
                    fontWeight:   700,
                    color:        NAVY,
                    marginBottom: '6px',
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    fontSize:   '12px',
                    color:      '#666',
                    lineHeight: 1.5,
                  }}
                >
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
              <SimulationCard
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

    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #E5E9F0' }}>
      <CvLinkedInPanel scripts={initial.cvScripts} simulationTitles={initial.simulationTitles} />
    </div>

    {previewTemplate !== null && (
      <TemplatePreviewModal
        template={previewTemplate}
        saving={modalSaving}
        error={modalError}
        onApply={() => { void handleApplyTemplate(previewTemplate); }}
        onClose={() => { setPreviewTemplate(null); setModalError(null); }}
      />
    )}
    </>
  );
}

function ProfessionalSchematic() {
  function Blk({ w, h, bg = '#E0E6EE' }: { w: string; h: number; bg?: string }) {
    return <div style={{ width: w, height: `${h}px`, background: bg, borderRadius: '2px', flexShrink: 0 }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Blk w="58%" h={18} bg="#C5D0DC" />
      <Blk w="78%" h={11} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E0E6EE' }} />
        <Blk w="28%" h={9} />
      </div>
      <div style={{ height: '4px' }} />
      <Blk w="100%" h={9} bg="#EDF0F4" />
      <Blk w="92%"  h={9} bg="#EDF0F4" />
      <Blk w="68%"  h={9} bg="#EDF0F4" />
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <div style={{ height: '20px', width: '58px', background: '#0A66C2', borderRadius: '2px', opacity: 0.75 }} />
        <div style={{ height: '20px', width: '44px', background: '#E0E6EE', borderRadius: '2px' }} />
      </div>
      <div style={{ height: '1px', background: '#E5E9F0', margin: '8px 0' }} />
      <div style={{ display: 'flex', gap: '20px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Blk w="22px" h={16} bg="#C5D0DC" />
            <Blk w="52px" h={8} />
          </div>
        ))}
      </div>
      <div style={{ height: '4px' }} />
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            height: '42px', border: '1px solid #D5DCE8', background: '#fff',
            padding: '0 10px', display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <div style={{ flex: 1, height: '9px', background: '#E0E6EE', borderRadius: '2px' }} />
          <div style={{ height: '18px', width: '44px', background: '#B8D9E4', borderRadius: '2px' }} />
        </div>
      ))}
    </div>
  );
}

function FocusedSchematic() {
  function Blk({ w, h, bg = '#E0E6EE' }: { w: string; h: number; bg?: string }) {
    return <div style={{ width: w, height: `${h}px`, background: bg, borderRadius: '2px', flexShrink: 0 }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Blk w="58%" h={18} bg="#C5D0DC" />
      <Blk w="78%" h={11} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E0E6EE' }} />
        <Blk w="28%" h={9} />
      </div>
      <div style={{ background: '#003359', padding: '10px 14px', display: 'flex', gap: '20px', marginTop: '4px', marginBottom: '4px' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ width: '18px', height: '14px', background: 'rgba(255,255,255,0.85)', borderRadius: '2px' }} />
            <div style={{ width: '48px', height: '7px', background: 'rgba(77,197,210,0.8)', borderRadius: '2px' }} />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            height: '42px', border: '1px solid #D5DCE8', background: '#fff',
            padding: '0 10px', display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <div style={{ flex: 1, height: '9px', background: '#E0E6EE', borderRadius: '2px' }} />
          <div style={{ height: '18px', width: '44px', background: '#B8D9E4', borderRadius: '2px' }} />
        </div>
      ))}
      <div style={{ height: '1px', background: '#E5E9F0', margin: '8px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '16px', height: '1px', background: '#4DC5D2' }} />
        <div style={{ width: '36px', height: '8px', background: '#4DC5D2', borderRadius: '2px', opacity: 0.6 }} />
      </div>
      <Blk w="100%" h={9} bg="#EDF0F4" />
      <Blk w="68%"  h={9} bg="#EDF0F4" />
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <div style={{ height: '20px', width: '58px', background: '#0A66C2', borderRadius: '2px', opacity: 0.75 }} />
        <div style={{ height: '20px', width: '44px', background: '#E0E6EE', borderRadius: '2px' }} />
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  template,
  saving,
  error,
  onApply,
  onClose,
}: {
  template: PortfolioTemplate;
  saving:   boolean;
  error:    string | null;
  onApply:  () => void;
  onClose:  () => void;
}) {
  const label = template === 'focused' ? 'Focused' : 'Professional';

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.55)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:     '#fff',
          width:          'min(480px, 100%)',
          maxHeight:      '85vh',
          display:        'flex',
          flexDirection:  'column',
          overflow:       'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '18px 20px 14px',
            borderBottom:   '1px solid #E5E9F0',
            flexShrink:     0,
          }}
        >
          <div>
            <div
              style={{
                fontSize:      '11px',
                color:         '#888',
                fontWeight:    600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom:  '4px',
              }}
            >
              Layout Preview
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: NAVY }}>
              {label}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              background: 'transparent',
              border:     'none',
              fontSize:   '22px',
              color:      '#999',
              cursor:     'pointer',
              padding:    '4px 8px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Schematic */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '20px' }}>
          {template === 'focused' ? <FocusedSchematic /> : <ProfessionalSchematic />}
        </div>

        {/* Footer */}
        <div
          style={{
            padding:     '14px 20px',
            borderTop:   '1px solid #E5E9F0',
            flexShrink:  0,
            display:     'flex',
            gap:         '10px',
            alignItems:  'center',
            flexWrap:    'wrap',
          }}
        >
          <button
            type="button"
            onClick={onApply}
            disabled={saving}
            style={{
              background:    NAVY,
              color:         '#fff',
              border:        'none',
              padding:       '10px 22px',
              fontSize:      '13px',
              fontWeight:    600,
              letterSpacing: '0.06em',
              cursor:        saving ? 'not-allowed' : 'pointer',
              opacity:       saving ? 0.7 : 1,
              fontFamily:    'inherit',
            }}
          >
            {saving ? 'Applying…' : 'Apply this layout'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background:  'transparent',
              color:       '#555',
              border:      '1px solid #D5DCE8',
              padding:     '10px 18px',
              fontSize:    '13px',
              fontWeight:  500,
              cursor:      saving ? 'not-allowed' : 'pointer',
              fontFamily:  'inherit',
            }}
          >
            Cancel
          </button>
          {error && (
            <p style={{ fontSize: '12px', color: '#c0392b', margin: 0, width: '100%' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
  disabled = false,
}: {
  label:    string;
  checked:  boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '12px',
        opacity:        disabled ? 0.4 : 1,
        transition:     'opacity 0.15s ease',
      }}
    >
      <span style={{ fontSize: '13px', color: '#4A5568', fontWeight: 500, userSelect: 'none' }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        style={{
          width:        '40px',
          height:       '22px',
          borderRadius: '11px',
          background:   checked ? TEAL : '#D0D8E4',
          border:       'none',
          cursor:       disabled ? 'not-allowed' : 'pointer',
          position:     'relative',
          transition:   'background 0.22s ease',
          flexShrink:   0,
          padding:      0,
          outline:      'none',
        }}
      >
        <span
          style={{
            position:     'absolute',
            top:          '2px',
            left:         checked ? '20px' : '2px',
            width:        '18px',
            height:       '18px',
            borderRadius: '50%',
            background:   '#fff',
            boxShadow:    '0 1px 4px rgba(0,0,0,0.22)',
            transition:   'left 0.22s ease',
            display:      'block',
          }}
        />
      </button>
    </div>
  );
}

function SimulationCard({
  sim,
  onChange,
}: {
  sim:      EditableSimulation;
  onChange: (patch: Partial<EditableSimulation>) => void;
}) {

  const [showDebrief,        setShowDebrief]        = useState(sim.showDebrief);
  const [debriefToggling,    setDebriefToggling]    = useState(false);
  const [debriefToggleError, setDebriefToggleError] = useState<string | null>(null);

  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [evidence,           setEvidence]           = useState<EvidenceItem[]>(sim.evidence ?? []);
  const [evidenceError,      setEvidenceError]      = useState<string | null>(null);
  const [addingMode,         setAddingMode]         = useState<'none' | 'link'>('none');
  const [uploadingFile,      setUploadingFile]      = useState<{ tempId: string; filename: string } | null>(null);
  const [editingId,          setEditingId]          = useState<string | null>(null);
  const [deleteConfirmId,    setDeleteConfirmId]    = useState<string | null>(null);

  const fileInputRef    = useRef<HTMLInputElement | null>(null);
  const deleteTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  async function handleToggleDebrief() {
    if (!sim.debriefId || debriefToggling) return;
    const next = !showDebrief;
    setShowDebrief(next);
    setDebriefToggling(true);
    setDebriefToggleError(null);
    try {
      const res = await fetch(`/api/debrief/${sim.debriefId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_visible: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `Failed (${res.status})`);
      }
    } catch (err) {
      setShowDebrief(!next);
      setDebriefToggleError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setDebriefToggling(false);
    }
  }

  const atLimit = evidence.length >= MAX_EVIDENCE;

  function openFilePicker() {
    setEvidenceError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const lastDot = file.name.lastIndexOf('.');
    const defaultTitleRaw = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
    const defaultTitle    = defaultTitleRaw.trim().substring(0, EVIDENCE_TITLE_MAX) || 'Evidence';

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploadingFile({ tempId, filename: file.name });
    setEvidenceError(null);

    try {
      const formData = new FormData();
      formData.append('file',          file);
      formData.append('simulation_id', sim.simulationSlug);
      formData.append('title',         defaultTitle);

      const res = await fetch('/api/portfolio/evidence', {
        method: 'POST',
        body:   formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = (errJson as { error?: string }).error ?? `Failed to upload (${res.status})`;
        throw new Error(message);
      }

      const json = await res.json();
      const newRow = (json as { evidence: EvidenceItem }).evidence;
      setEvidence((prev) => [...prev, newRow]);
      setUploadingFile(null);
    } catch (err) {
      setUploadingFile(null);
      const message = err instanceof Error ? err.message : 'Failed to upload';
      setEvidenceError(`Failed to upload: ${message}`);
    }
  }

  async function handleAddLink(
    title: string,
    url: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    setEvidenceError(null);
    try {
      const formData = new FormData();
      formData.append('simulation_id', sim.simulationSlug);
      formData.append('title',         title);
      formData.append('url',           url);

      const res = await fetch('/api/portfolio/evidence', {
        method: 'POST',
        body:   formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = (errJson as { error?: string }).error ?? `Failed to save (${res.status})`;
        return { ok: false, error: message };
      }

      const json   = await res.json();
      const newRow = (json as { evidence: EvidenceItem }).evidence;
      setEvidence((prev) => [...prev, newRow]);
      setAddingMode('none');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { ok: false, error: message };
    }
  }

  async function handleSaveEdit(
    id: string,
    title: string,
    description: string | null,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    setEvidenceError(null);
    try {
      const res = await fetch(`/api/portfolio/evidence/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, description }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = (errJson as { error?: string }).error ?? `Failed to save (${res.status})`;
        return { ok: false, error: message };
      }

      const json    = await res.json();
      const updated = (json as { evidence: EvidenceItem }).evidence;
      setEvidence((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingId(null);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { ok: false, error: message };
    }
  }

  async function handleToggleVisibility(id: string, current: boolean) {
    const next = !current;
    setEvidence((prev) => prev.map((e) => (e.id === id ? { ...e, is_visible: next } : e)));
    setEvidenceError(null);

    try {
      const res = await fetch(`/api/portfolio/evidence/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_visible: next }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = (errJson as { error?: string }).error ?? `Failed to update visibility (${res.status})`;
        throw new Error(message);
      }
    } catch (err) {
      setEvidence((prev) => prev.map((e) => (e.id === id ? { ...e, is_visible: current } : e)));
      const message = err instanceof Error ? err.message : 'Failed to update visibility';
      setEvidenceError(message);
    }
  }

  function startDeleteConfirm(id: string) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeleteConfirmId(id);
    deleteTimerRef.current = setTimeout(() => {
      setDeleteConfirmId(null);
      deleteTimerRef.current = null;
    }, DELETE_CONFIRM_WINDOW_MS);
  }

  async function handleDeleteClick(id: string) {
    if (deleteConfirmId !== id) {
      startDeleteConfirm(id);
      return;
    }

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setDeleteConfirmId(null);
    setEvidenceError(null);

    try {
      const res = await fetch(`/api/portfolio/evidence/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const errJson = await res.json().catch(() => ({}));
        const message = (errJson as { error?: string }).error ?? `Failed to delete (${res.status})`;
        throw new Error(message);
      }
      setEvidence((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      setEvidenceError(message);
    }
  }

  return (
    <div
      style={{
        border:        '1.5px solid #E8EDF4',
        borderRadius:  '16px',
        background:    '#fff',
        boxShadow:     '0 2px 12px rgba(0,51,89,0.07)',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top row: simulation info + visibility toggles ──── */}
      <div
        style={{
          padding:    '20px 22px',
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
              fontWeight:   700,
              color:        NAVY,
              marginBottom: '4px',
              lineHeight:   1.3,
            }}
          >
            {sim.title}
          </p>
          <p
            style={{
              fontSize:     '12px',
              color:        '#7A8A9A',
              marginBottom: '10px',
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
          <ToggleRow
            label="Show on portfolio"
            checked={sim.showOnPortfolio}
            onToggle={() => onChange({ showOnPortfolio: !sim.showOnPortfolio })}
          />
          <ToggleRow
            label="Show score"
            checked={sim.showScores}
            disabled={!sim.showOnPortfolio}
            onToggle={() => onChange({ showScores: !sim.showScores })}
          />
          <ToggleRow
            label="Show feedback"
            checked={sim.showFeedback}
            disabled={!sim.showOnPortfolio}
            onToggle={() => onChange({ showFeedback: !sim.showFeedback })}
          />
          {sim.debriefId && (
            <ToggleRow
              label="Show reflection"
              checked={showDebrief}
              disabled={!sim.showOnPortfolio || debriefToggling}
              onToggle={handleToggleDebrief}
            />
          )}
          {debriefToggleError && (
            <p style={{ fontSize: '11px', color: '#c0392b', margin: '2px 0 0' }}>
              {debriefToggleError}
            </p>
          )}
        </div>
      </div>

      {/* ── Evidence section ─────────────────────────────── */}
      <div
        style={{
          borderTop:  '1.5px solid #F0F4F8',
          background: '#F8FAFC',
        }}
      >
        <button
          type="button"
          onClick={() => setIsEvidenceExpanded((v) => !v)}
          className="pf-evidence-header"
          style={{
            width:          '100%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            background:     'transparent',
            border:         'none',
            padding:        '11px 22px',
            cursor:         'pointer',
            fontSize:       '11px',
            fontWeight:     700,
            color:          '#7A8A9A',
            letterSpacing:  '0.1em',
            textTransform:  'uppercase',
            fontFamily:     'inherit',
          }}
          aria-expanded={isEvidenceExpanded}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            Evidence ({evidence.length})
          </span>
          <span style={{
            width:          '22px',
            height:         '22px',
            borderRadius:   '50%',
            background:     isEvidenceExpanded ? TEAL : '#E0E8F0',
            color:          isEvidenceExpanded ? '#fff' : '#7A8A9A',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '15px',
            lineHeight:     1,
            transition:     'background 0.2s ease, color 0.2s ease',
            flexShrink:     0,
          }}>
            {isEvidenceExpanded ? '−' : '+'}
          </span>
        </button>

        {isEvidenceExpanded && (
          <div style={{ padding: '0 22px 18px' }}>
            {evidenceError && (
              <p
                style={{
                  fontSize:    '12px',
                  color:       '#c0392b',
                  background:  '#fdecea',
                  border:      '1px solid #f5c6cb',
                  padding:     '8px 10px',
                  marginBottom: '10px',
                  lineHeight:  1.5,
                }}
              >
                {evidenceError}
              </p>
            )}

            {evidence.length === 0 && !uploadingFile && (
              <p
                style={{
                  fontSize:     '12px',
                  color:        '#999',
                  margin:       '4px 0 12px',
                }}
              >
                No evidence yet. Attach a file or link to show recruiters what you produced.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {evidence.map((item) => (
                editingId === item.id ? (
                  <EvidenceEditForm
                    key={item.id}
                    item={item}
                    onCancel={() => setEditingId(null)}
                    onSave={(title, description) => handleSaveEdit(item.id, title, description)}
                  />
                ) : (
                  <EvidenceRow
                    key={item.id}
                    item={item}
                    isDeleteConfirming={deleteConfirmId === item.id}
                    onEdit={() => {
                      setEditingId(item.id);
                      setEvidenceError(null);
                    }}
                    onToggleVisibility={() => handleToggleVisibility(item.id, item.is_visible)}
                    onDelete={() => handleDeleteClick(item.id)}
                  />
                )
              ))}

              {uploadingFile && (
                <div
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '10px',
                    padding:    '8px 0',
                    borderTop:  '1px solid #ECECEC',
                    fontSize:   '13px',
                    color:      '#888',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>⏳</span>
                  <span
                    style={{
                      flex:         '1 1 auto',
                      minWidth:     0,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {uploadingFile.filename}
                  </span>
                  <span style={{ fontSize: '12px', fontStyle: 'italic' }}>Uploading…</span>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={EVIDENCE_ACCEPT}
              onChange={handleFileChosen}
              style={{ display: 'none' }}
            />

            {/* Add controls */}
            {addingMode === 'link' ? (
              <AddLinkForm
                onCancel={() => setAddingMode('none')}
                onSave={handleAddLink}
              />
            ) : (
              <div style={{ marginTop: evidence.length > 0 || uploadingFile ? '12px' : '0' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={atLimit || !!uploadingFile}
                    className="pf-add-evidence"
                    style={{
                      background:    atLimit || uploadingFile ? 'transparent' : '#fff',
                      border:        `1.5px solid ${atLimit || uploadingFile ? '#D5DCE8' : TEAL}`,
                      borderRadius:  '20px',
                      color:         atLimit || uploadingFile ? '#aaa' : TEAL,
                      padding:       '6px 14px',
                      fontSize:      '12px',
                      fontWeight:    600,
                      letterSpacing: '0.04em',
                      cursor:        atLimit || uploadingFile ? 'not-allowed' : 'pointer',
                      fontFamily:    'inherit',
                      transition:    'background 0.15s, border-color 0.15s',
                    }}
                  >
                    + Add file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingMode('link');
                      setEvidenceError(null);
                    }}
                    disabled={atLimit || !!uploadingFile}
                    className="pf-add-evidence"
                    style={{
                      background:    atLimit || uploadingFile ? 'transparent' : '#fff',
                      border:        `1.5px solid ${atLimit || uploadingFile ? '#D5DCE8' : TEAL}`,
                      borderRadius:  '20px',
                      color:         atLimit || uploadingFile ? '#aaa' : TEAL,
                      padding:       '6px 14px',
                      fontSize:      '12px',
                      fontWeight:    600,
                      letterSpacing: '0.04em',
                      cursor:        atLimit || uploadingFile ? 'not-allowed' : 'pointer',
                      fontFamily:    'inherit',
                      transition:    'background 0.15s, border-color 0.15s',
                    }}
                  >
                    + Add link
                  </button>
                </div>
                {atLimit && (
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                    Maximum 5 items. Remove one to add another.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceRow({
  item,
  isDeleteConfirming,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  item:               EvidenceItem;
  isDeleteConfirming: boolean;
  onEdit:             () => void;
  onToggleVisibility: () => void;
  onDelete:           () => void;
}) {
  const href = item.evidence_type === 'link' ? item.external_url : item.file_url;
  const icon = EVIDENCE_TYPE_ICON[item.evidence_type] ?? '📎';

  const actionButtonStyle: React.CSSProperties = {
    background:  'transparent',
    border:      'none',
    padding:     '2px 6px',
    fontSize:    '12px',
    color:       '#666',
    cursor:      'pointer',
    fontFamily:  'inherit',
    lineHeight:  1.2,
  };

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '10px',
        padding:    '8px 0',
        borderTop:  '1px solid #ECECEC',
        fontSize:   '13px',
      }}
    >
      <span style={{ fontSize: '16px', flex: '0 0 auto' }}>{icon}</span>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex:           '1 1 auto',
            minWidth:       0,
            color:          NAVY,
            textDecoration: 'none',
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            whiteSpace:     'nowrap',
            opacity:        item.is_visible ? 1 : 0.55,
          }}
        >
          {item.title}
        </a>
      ) : (
        <span
          style={{
            flex:         '1 1 auto',
            minWidth:     0,
            color:        NAVY,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            opacity:      item.is_visible ? 1 : 0.55,
          }}
        >
          {item.title}
        </span>
      )}

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${item.title}`}
        className="pf-evidence-action"
        style={actionButtonStyle}
      >
        ✎ Edit
      </button>

      <button
        type="button"
        onClick={onToggleVisibility}
        aria-label={item.is_visible ? 'Hide from portfolio' : 'Show on portfolio'}
        className="pf-evidence-action"
        style={{
          ...actionButtonStyle,
          color: item.is_visible ? '#666' : '#aaa',
        }}
      >
        {item.is_visible ? '👁 Visible' : '👁 Hidden'}
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={isDeleteConfirming ? 'Confirm delete' : `Delete ${item.title}`}
        className="pf-evidence-delete"
        style={{
          ...actionButtonStyle,
          color:      isDeleteConfirming ? '#c0392b' : '#999',
          fontWeight: isDeleteConfirming ? 600 : 400,
        }}
      >
        {isDeleteConfirming ? 'Confirm delete?' : '× Delete'}
      </button>
    </div>
  );
}

function EvidenceEditForm({
  item,
  onCancel,
  onSave,
}: {
  item:     EvidenceItem;
  onCancel: () => void;
  onSave:   (title: string, description: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [title,       setTitle]       = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [formError,   setFormError]   = useState<string | null>(null);
  const [saveState,   setSaveState]   = useState<SaveState>('idle');

  async function submit() {
    const titleTrim = title.trim();
    const descTrim  = description.trim();

    if (!titleTrim) {
      setFormError('Title is required');
      return;
    }
    if (titleTrim.length > EVIDENCE_TITLE_MAX) {
      setFormError(`Title must be ${EVIDENCE_TITLE_MAX} characters or fewer`);
      return;
    }
    if (descTrim.length > EVIDENCE_DESCRIPTION_MAX) {
      setFormError(`Description must be ${EVIDENCE_DESCRIPTION_MAX} characters or fewer`);
      return;
    }

    setFormError(null);
    setSaveState('saving');
    const result = await onSave(titleTrim, descTrim || null);
    if (!result.ok) {
      setSaveState('error');
      setFormError(result.error);
    }
    // On success the parent unmounts this form by clearing editingId.
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
        padding:       '10px 0',
        borderTop:     '1px solid #ECECEC',
      }}
    >
      <input
        className="pf-input"
        type="text"
        value={title}
        maxLength={EVIDENCE_TITLE_MAX}
        placeholder="Title"
        onChange={(e) => setTitle(e.target.value)}
        style={{ ...fieldStyle, padding: '8px 10px', fontSize: '13px' }}
        aria-label="Evidence title"
      />
      <textarea
        className="pf-textarea"
        value={description}
        maxLength={EVIDENCE_DESCRIPTION_MAX}
        placeholder="Description (optional)"
        onChange={(e) => setDescription(e.target.value)}
        style={{
          ...fieldStyle,
          padding:    '8px 10px',
          fontSize:   '13px',
          minHeight:  '60px',
          resize:     'vertical',
          lineHeight: 1.5,
        }}
        aria-label="Evidence description"
      />
      <div
        style={{
          fontSize:    '11px',
          color:       '#888',
          textAlign:   'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {description.length} / {EVIDENCE_DESCRIPTION_MAX}
      </div>

      {formError && (
        <p style={{ fontSize: '12px', color: '#c0392b', margin: 0 }}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={submit}
          disabled={saveState === 'saving'}
          style={{
            background:    NAVY,
            color:         '#fff',
            border:        'none',
            padding:       '6px 14px',
            fontSize:      '12px',
            fontWeight:    600,
            letterSpacing: '0.04em',
            cursor:        saveState === 'saving' ? 'not-allowed' : 'pointer',
            opacity:       saveState === 'saving' ? 0.7 : 1,
            fontFamily:    'inherit',
          }}
        >
          {saveState === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saveState === 'saving'}
          style={{
            background:  'transparent',
            color:       '#666',
            border:      '1px solid #D5DCE8',
            padding:     '6px 14px',
            fontSize:    '12px',
            fontWeight:  500,
            cursor:      saveState === 'saving' ? 'not-allowed' : 'pointer',
            fontFamily:  'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddLinkForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave:   (title: string, url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [title,     setTitle]     = useState('');
  const [url,       setUrl]       = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  async function submit() {
    const titleTrim = title.trim();
    const urlTrim   = url.trim();

    if (!titleTrim) {
      setFormError('Title is required');
      return;
    }
    if (titleTrim.length > EVIDENCE_TITLE_MAX) {
      setFormError(`Title must be ${EVIDENCE_TITLE_MAX} characters or fewer`);
      return;
    }
    if (!urlTrim) {
      setFormError('URL is required');
      return;
    }
    if (!isValidUrl(urlTrim)) {
      setFormError('URL must start with http:// or https://');
      return;
    }

    setFormError(null);
    setSaveState('saving');
    const result = await onSave(titleTrim, urlTrim);
    if (!result.ok) {
      setSaveState('error');
      setFormError(result.error);
    }
    // On success the parent unmounts this form by clearing addingMode.
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
        marginTop:     '12px',
        padding:       '12px',
        border:        '1px solid #D5DCE8',
        background:    '#fff',
      }}
    >
      <input
        className="pf-input"
        type="text"
        value={title}
        maxLength={EVIDENCE_TITLE_MAX}
        placeholder="Title (e.g. Figma prototype)"
        onChange={(e) => setTitle(e.target.value)}
        style={{ ...fieldStyle, padding: '8px 10px', fontSize: '13px' }}
        aria-label="Link title"
      />
      <input
        className="pf-input"
        type="url"
        value={url}
        placeholder="https://example.com/your-work"
        pattern="https?://.+"
        onChange={(e) => setUrl(e.target.value)}
        style={{ ...fieldStyle, padding: '8px 10px', fontSize: '13px' }}
        aria-label="Link URL"
      />

      {formError && (
        <p style={{ fontSize: '12px', color: '#c0392b', margin: 0 }}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={submit}
          disabled={saveState === 'saving'}
          style={{
            background:    NAVY,
            color:         '#fff',
            border:        'none',
            padding:       '6px 14px',
            fontSize:      '12px',
            fontWeight:    600,
            letterSpacing: '0.04em',
            cursor:        saveState === 'saving' ? 'not-allowed' : 'pointer',
            opacity:       saveState === 'saving' ? 0.7 : 1,
            fontFamily:    'inherit',
          }}
        >
          {saveState === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saveState === 'saving'}
          style={{
            background:  'transparent',
            color:       '#666',
            border:      '1px solid #D5DCE8',
            padding:     '6px 14px',
            fontSize:    '12px',
            fontWeight:  500,
            cursor:      saveState === 'saving' ? 'not-allowed' : 'pointer',
            fontFamily:  'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

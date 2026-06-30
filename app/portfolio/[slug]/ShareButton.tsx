'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TEAL = '#4DC5D2';
const NAVY = '#003359';

type Props = {
  candidateName: string;
  slug: string;
};

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.529 5.845L.057 23.25l5.565-1.452A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.373l-.36-.213-3.305.862.884-3.216-.234-.37A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function ShareButton({ candidateName, slug }: Props) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const portfolioUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://app.evidentize.io'}/portfolio/${slug}`;

  const encodedUrl   = encodeURIComponent(portfolioUrl);
  const tweetText    = encodeURIComponent(
    `${candidateName} has earned verified credentials through Evidentize workplace simulations.`
  );
  const whatsappText = encodeURIComponent(
    `${candidateName} has earned verified credentials through Evidentize workplace simulations.\n\nView their portfolio here: ${portfolioUrl}`
  );
  const emailSubject = encodeURIComponent(`${candidateName}'s Verified Portfolio — Evidentize`);
  const emailBody    = encodeURIComponent(
    `Hi,\n\nI wanted to share ${candidateName}'s verified portfolio on Evidentize.\n\n` +
    `${candidateName} has completed real workplace simulations and earned credentials that demonstrate proven skills.\n\n` +
    `View their portfolio here:\n${portfolioUrl}`
  );

  const platforms = [
    {
      label:    'LinkedIn',
      icon:     <LinkedInIcon />,
      iconBg:   '#0A66C2',
      href:     `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label:    'X (Twitter)',
      icon:     <XIcon />,
      iconBg:   '#000',
      href:     `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`,
    },
    {
      label:    'WhatsApp',
      icon:     <WhatsAppIcon />,
      iconBg:   '#25D366',
      href:     `https://wa.me/?text=${whatsappText}`,
    },
    {
      label:    'Email',
      icon:     <EmailIcon />,
      iconBg:   NAVY,
      href:     `mailto:?subject=${emailSubject}&body=${emailBody}`,
    },
  ];

  async function copyLink() {
    await navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const displayUrl = portfolioUrl.replace(/^https?:\/\//, '');

  const modal = open && mounted ? createPortal(
    <>
      <style>{`
        @keyframes share-fade-in {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .share-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 16px;
          border: 1.5px solid #E8EDF4;
          border-radius: 14px;
          text-decoration: none;
          background: #fff;
          cursor: pointer;
          font-family: inherit;
          width: 100%;
          text-align: left;
          transition: border-color 0.18s ease, background 0.18s ease, transform 0.15s ease;
          color: ${NAVY};
        }
        .share-row:hover {
          border-color: ${TEAL};
          background: #F5FDFE;
          transform: translateY(-1px);
        }
        .share-row:active { transform: translateY(0); }
        .share-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: #F3F3F3;
          cursor: pointer;
          color: #888;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .share-close-btn:hover { background: #E8EDF4; color: ${NAVY}; }
        .share-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 20px;
          border: none;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.02em;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease;
        }
        .share-copy-btn:active { transform: scale(0.97); }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share portfolio"
        onClick={() => setOpen(false)}
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0, 20, 40, 0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex:         9999,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '20px',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background:   '#fff',
            width:        '100%',
            maxWidth:     '420px',
            borderRadius: '24px',
            boxShadow:    '0 24px 64px rgba(0,51,89,0.22), 0 4px 16px rgba(0,51,89,0.08)',
            padding:      '32px 28px 28px',
            position:     'relative',
            animation:    'share-fade-in 0.22s ease both',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width:        '44px',
                height:       '44px',
                borderRadius: '12px',
                background:   `linear-gradient(135deg, ${TEAL}, #006FAD)`,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                color:        '#fff',
                flexShrink:   0,
              }}>
                <ShareIcon />
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: TEAL, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 2px' }}>
                  Portfolio
                </p>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.2 }}>
                  Share this portfolio
                </h3>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close share dialog"
              className="share-close-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Section label */}
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#9BAABB', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            Share via
          </p>

          {/* Platform rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {platforms.map(p => (
              <a
                key={p.label}
                href={p.href}
                target={p.href.startsWith('mailto') ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="share-row"
                onClick={() => setOpen(false)}
              >
                {/* Circle icon */}
                <span style={{
                  width:          '38px',
                  height:         '38px',
                  borderRadius:   '50%',
                  background:     p.iconBg,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  color:          '#fff',
                  flexShrink:     0,
                }}>
                  {p.icon}
                </span>

                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em' }}>
                  {p.label}
                </span>

                <span style={{ color: '#C0CBD8', flexShrink: 0 }}>
                  <ChevronRight />
                </span>
              </a>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E8EDF4' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#9BAABB', letterSpacing: '0.12em', textTransform: 'uppercase' }}>or copy link</span>
            <div style={{ flex: 1, height: '1px', background: '#E8EDF4' }} />
          </div>

          {/* Copy link bar */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
            padding:      '10px 10px 10px 14px',
            border:       `1.5px solid ${copied ? TEAL : '#E8EDF4'}`,
            borderRadius: '14px',
            background:   copied ? '#F5FDFE' : '#FAFBFD',
            transition:   'border-color 0.2s ease, background 0.2s ease',
          }}>
            <span style={{ color: copied ? TEAL : '#9BAABB', flexShrink: 0, display: 'flex' }}>
              {copied ? <CheckIcon /> : <LinkIcon />}
            </span>
            <span style={{
              flex:         1,
              fontSize:     '12px',
              color:        '#6B7A8D',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              fontFamily:   'monospace',
              minWidth:     0,
            }}>
              {displayUrl}
            </span>
            <button
              onClick={copyLink}
              className="share-copy-btn"
              style={{
                background: copied ? TEAL : NAVY,
                color:      '#fff',
              }}
            >
              {copied ? <><CheckIcon /> Copied!</> : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <style>{`
        .share-trigger-btn {
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .share-trigger-btn:hover {
          background: #F5FDFE !important;
          border-color: ${TEAL} !important;
          transform: translateY(-1px);
        }
        .share-trigger-btn:active { transform: translateY(0); }
      `}</style>

      <button
        onClick={() => setOpen(true)}
        className="share-trigger-btn"
        aria-label="Share portfolio"
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '6px',
          fontSize:      '11px',
          fontWeight:    600,
          color:         NAVY,
          background:    '#fff',
          border:        '1.5px solid #D5DCE8',
          borderRadius:  '8px',
          padding:       '7px 16px',
          cursor:        'pointer',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share
      </button>

      {modal}
    </>
  );
}

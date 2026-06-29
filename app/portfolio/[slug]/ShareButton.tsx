'use client';

import { useState } from 'react';

const TEAL = '#4DC5D2';
const NAVY = '#003359';

type Props = {
  candidateName: string;
  slug: string;
};

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.529 5.845L.057 23.25l5.565-1.452A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.373l-.36-.213-3.305.862.884-3.216-.234-.37A9.818 9.818 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function ShareButton({ candidateName, slug }: Props) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

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
      label: 'LinkedIn',
      icon:  <LinkedInIcon />,
      bg:    '#0A66C2',
      color: '#fff',
      href:  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: 'X (Twitter)',
      icon:  <XIcon />,
      bg:    '#000',
      color: '#fff',
      href:  `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`,
    },
    {
      label: 'WhatsApp',
      icon:  <WhatsAppIcon />,
      bg:    '#25D366',
      color: '#fff',
      href:  `https://wa.me/?text=${whatsappText}`,
    },
    {
      label: 'Email',
      icon:  <EmailIcon />,
      bg:    '#F3F3F3',
      color: NAVY,
      href:  `mailto:?subject=${emailSubject}&body=${emailBody}`,
    },
  ];

  async function copyLink() {
    await navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <>
      <style>{`
        .share-trigger-btn { transition: background 0.15s ease; }
        .share-trigger-btn:hover { background: #F3F3F3 !important; }
        .share-platform-row { transition: opacity 0.15s ease; }
        .share-platform-row:hover { opacity: 0.85; }
      `}</style>

      {/* Trigger button */}
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
          border:        '1px solid #D5DCE8',
          padding:       '6px 14px',
          cursor:        'pointer',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily:    'inherit',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 1v8M3 4l3-3 3 3M1 9h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share
      </button>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share portfolio"
          onClick={() => setOpen(false)}
          style={{
            position:        'fixed',
            inset:           0,
            background:      'rgba(0,0,0,0.45)',
            zIndex:          300,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            padding:         '16px',
          }}
        >
          {/* Panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:   '#fff',
              width:        '100%',
              maxWidth:     '400px',
              boxShadow:    '0 8px 40px rgba(0,51,89,0.18)',
              padding:      '28px 24px 24px',
              position:     'relative',
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close share dialog"
              style={{
                position:   'absolute',
                top:        '14px',
                right:      '14px',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                color:      '#aaa',
                padding:    '4px',
                lineHeight: 1,
                display:    'flex',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header */}
            <p style={{ fontSize: '10px', fontWeight: 600, color: TEAL, letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              Portfolio
            </p>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: NAVY, margin: '0 0 20px' }}>
              Share this portfolio
            </h3>

            {/* Platform rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {platforms.map(p => (
                <a
                  key={p.label}
                  href={p.href}
                  target={p.href.startsWith('mailto') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="share-platform-row"
                  onClick={() => setOpen(false)}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            '12px',
                    fontSize:       '13px',
                    fontWeight:     600,
                    color:          p.color,
                    background:     p.bg,
                    padding:        '11px 16px',
                    textDecoration: 'none',
                    letterSpacing:  '0.02em',
                  }}
                >
                  {p.icon}
                  {p.label}
                </a>
              ))}

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="share-platform-row"
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           '12px',
                  fontSize:      '13px',
                  fontWeight:    600,
                  color:         copied ? TEAL : NAVY,
                  background:    '#F3F3F3',
                  border:        'none',
                  padding:       '11px 16px',
                  cursor:        'pointer',
                  letterSpacing: '0.02em',
                  fontFamily:    'inherit',
                  width:         '100%',
                  textAlign:     'left',
                  transition:    'color 0.2s ease',
                }}
              >
                <CopyIcon done={copied} />
                {copied ? 'Link copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

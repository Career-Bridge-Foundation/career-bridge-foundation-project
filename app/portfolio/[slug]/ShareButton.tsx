'use client';

import { useState, useRef, useEffect } from 'react';

const TEAL = '#4DC5D2';
const NAVY = '#003359';

type Props = {
  candidateName: string;
  slug: string;
};

export function ShareButton({ candidateName, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const portfolioUrl = typeof window !== 'undefined'
    ? window.location.href
    : `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://app.evidentize.io'}/portfolio/${slug}`;
  const shareText = `Check out ${candidateName}'s verified portfolio on Evidentize`;

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${candidateName} — Evidentize Portfolio`,
          text:  shareText,
          url:   portfolioUrl,
        });
      } catch {
        // User cancelled — ignore
      }
      return;
    }
    setOpen(v => !v);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setOpen(false), 2200);
  }

  const encodedUrl  = encodeURIComponent(portfolioUrl);
  const encodedText = encodeURIComponent(shareText);

  const platforms = [
    {
      label:   'LinkedIn',
      bg:      '#0A66C2',
      color:   '#fff',
      href:    `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label:   'X (Twitter)',
      bg:      '#000',
      color:   '#fff',
      href:    `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      label:   'WhatsApp',
      bg:      '#25D366',
      color:   '#fff',
      href:    `https://wa.me/?text=${encodeURIComponent(`${shareText} ${portfolioUrl}`)}`,
    },
    {
      label:   'Email',
      bg:      '#fff',
      color:   NAVY,
      border:  '1px solid #D5DCE8',
      href:    `mailto:?subject=${encodeURIComponent(`${candidateName}'s Evidentize Portfolio`)}&body=${encodeURIComponent(`${shareText}\n\n${portfolioUrl}`)}`,
    },
  ];

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <style>{`
        .share-toggle-btn { transition: background 0.15s ease; }
        .share-toggle-btn:hover { background: #F3F3F3 !important; }
        .share-platform-link { transition: opacity 0.15s ease; display: block; }
        .share-platform-link:hover { opacity: 0.82; }
      `}</style>

      <button
        onClick={handleClick}
        className="share-toggle-btn"
        aria-label="Share portfolio"
        aria-expanded={open}
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

      {open && (
        <div
          role="dialog"
          aria-label="Share options"
          style={{
            position:      'absolute',
            top:           'calc(100% + 8px)',
            right:         0,
            background:    '#fff',
            border:        '1px solid #D5DCE8',
            boxShadow:     '0 4px 24px rgba(0,51,89,0.10)',
            padding:       '14px',
            zIndex:        100,
            minWidth:      '190px',
            display:       'flex',
            flexDirection: 'column',
            gap:           '7px',
          }}
        >
          <span
            style={{
              fontSize:      '10px',
              fontWeight:    600,
              color:         '#aaa',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom:  '2px',
            }}
          >
            Share portfolio
          </span>

          {platforms.map(p => (
            <a
              key={p.label}
              href={p.href}
              target={p.href.startsWith('mailto') ? '_self' : '_blank'}
              rel="noopener noreferrer"
              className="share-platform-link"
              onClick={() => setOpen(false)}
              style={{
                fontSize:       '12px',
                fontWeight:     600,
                color:          p.color,
                background:     p.bg,
                border:         p.border ?? 'none',
                padding:        '8px 14px',
                textDecoration: 'none',
                letterSpacing:  '0.04em',
                textAlign:      'center',
              }}
            >
              {p.label}
            </a>
          ))}

          <button
            onClick={copyLink}
            style={{
              fontSize:      '12px',
              fontWeight:    600,
              color:         copied ? TEAL : NAVY,
              background:    '#F3F3F3',
              border:        'none',
              padding:       '8px 14px',
              cursor:        'pointer',
              letterSpacing: '0.04em',
              fontFamily:    'inherit',
              textAlign:     'center',
              transition:    'color 0.2s ease',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';

const NAVY = '#003359';

type Props = { isOwner: boolean };

export function EditPortfolioButton({ isOwner }: Props) {
  if (!isOwner) return null;

  return (
    <>
      <style>{`
        .portfolio-edit-button {
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .portfolio-edit-button:hover {
          background: #F5FDFE !important;
          border-color: #4DC5D2 !important;
          transform: translateY(-1px);
        }
        .portfolio-edit-button:active { transform: translateY(0); }
      `}</style>
      <Link
        href="/portfolio/edit"
        className="portfolio-edit-button"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            '6px',
          fontSize:       '11px',
          fontWeight:     600,
          color:          NAVY,
          background:     '#fff',
          border:         '1.5px solid #D5DCE8',
          borderRadius:   '8px',
          padding:        '7px 16px',
          textDecoration: 'none',
          letterSpacing:  '0.06em',
          textTransform:  'uppercase',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit Portfolio
      </Link>
    </>
  );
}

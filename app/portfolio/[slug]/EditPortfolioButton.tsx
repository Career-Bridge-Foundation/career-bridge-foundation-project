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
          transition: background 0.15s ease;
        }
        .portfolio-edit-button:hover {
          background: #F3F3F3;
        }
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
          border:         '1px solid #D5DCE8',
          padding:        '6px 14px',
          textDecoration: 'none',
          letterSpacing:  '0.06em',
          textTransform:  'uppercase',
        }}
      >
        Edit Portfolio →
      </Link>
    </>
  );
}

import Link from 'next/link';

const NAVY = '#003359';
const TEAL = '#4DC5D2';

export default function PortfolioNotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#FAFAFA' }}
    >
      {/* Wordmark */}
      <p
        style={{
          fontSize:     '11px',
          fontWeight:   700,
          letterSpacing: '0.2em',
          color:        TEAL,
          textTransform: 'uppercase',
          marginBottom: '40px',
        }}
      >
        Career Bridge
      </p>

      {/* Headline */}
      <h1
        style={{
          fontFamily:  "'Fraunces', serif",
          fontSize:    'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight:  700,
          color:       NAVY,
          lineHeight:  1.2,
          marginBottom: '16px',
        }}
      >
        Portfolio not found
      </h1>

      <p
        style={{
          fontSize:    '15px',
          color:       '#888',
          lineHeight:  1.75,
          maxWidth:    '380px',
          marginBottom: '36px',
        }}
      >
        This portfolio link may be incorrect, or the candidate may have set
        their portfolio to private.
      </p>

      <Link
        href="/"
        style={{
          fontSize:       '13px',
          fontWeight:     600,
          color:          '#fff',
          background:     NAVY,
          padding:        '10px 24px',
          textDecoration: 'none',
          letterSpacing:  '0.06em',
        }}
      >
        Go to Career Bridge →
      </Link>
    </div>
  );
}

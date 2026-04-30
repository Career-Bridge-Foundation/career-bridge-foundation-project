import { ImageResponse } from 'next/og';
import { getPortfolioBySlug } from '@/lib/portfolio/getPortfolioBySlug';

export const alt = 'Career Bridge Portfolio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Fetches a TTF font from Google Fonts for use in ImageResponse.
 * Sends an old Safari User-Agent so Google returns TTF instead of woff2.
 * Returns null on any failure — ImageResponse falls back to a built-in font.
 */
async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) ' +
            'AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
        },
      }
    ).then(r => r.text());

    const url = css.match(/url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return fetch(url).then(r => r.arrayBuffer());
  } catch {
    return null;
  }
}

const CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Distinction':  { bg: '#1C1917', text: '#FBBF24', border: '#FBBF24' },
  'Merit':        { bg: '#003359', text: '#ffffff', border: 'rgba(255,255,255,0.4)' },
  'Pass':         { bg: '#006FAD', text: '#ffffff', border: '#006FAD' },
  'Borderline':   { bg: '#6B7280', text: '#ffffff', border: '#6B7280' },
  'Did Not Pass': { bg: 'transparent', text: '#9CA3AF', border: '#9CA3AF' },
};

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPortfolioBySlug(slug);

  // Render a generic branded fallback if portfolio not found
  const name     = data?.candidate.fullName ?? 'Career Bridge Portfolio';
  const headline = data?.profile.headline   ?? null;
  const bands    = (data?.simulations ?? []).map(s => s.highestBand).slice(0, 4);

  const [fraunces, inter] = await Promise.all([
    loadGoogleFont('Fraunces', 700),
    loadGoogleFont('Inter', 400),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style: 'normal' | 'italic';
  }[] = [];
  if (fraunces) fonts.push({ name: 'Fraunces', data: fraunces, weight: 700, style: 'normal' });
  if (inter)    fonts.push({ name: 'Inter',    data: inter,    weight: 400, style: 'normal' });

  return new ImageResponse(
    (
      <div
        style={{
          width:          '100%',
          height:         '100%',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'space-between',
          padding:        '64px 72px',
          background:     'linear-gradient(150deg, #004060 0%, #003359 45%, #001e36 100%)',
        }}
      >
        {/* ── Name + headline ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display:       'flex',
              fontFamily:    fraunces ? 'Fraunces' : 'serif',
              fontSize:      bands.length > 0 ? 68 : 78,
              fontWeight:    700,
              color:         '#ffffff',
              lineHeight:    1.05,
              letterSpacing: '-0.01em',
              maxWidth:      880,
            }}
          >
            {name}
          </div>

          {headline && (
            <div
              style={{
                display:    'flex',
                fontFamily: inter ? 'Inter' : 'sans-serif',
                fontSize:   26,
                fontWeight: 400,
                color:      'rgba(255,255,255,0.6)',
                lineHeight: 1.4,
                maxWidth:   700,
              }}
            >
              {headline}
            </div>
          )}
        </div>

        {/* ── Verdict chips ── */}
        {bands.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            {bands.map(band => {
              const s = CHIP_STYLES[band] ?? CHIP_STYLES['Did Not Pass'];
              return (
                <div
                  key={band}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    padding:       '8px 18px',
                    background:    s.bg,
                    border:        `1px solid ${s.border}`,
                    color:         s.text,
                    fontSize:      13,
                    fontWeight:    700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    borderRadius:  3,
                  }}
                >
                  {band}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Branding footer ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display:       'flex',
              fontFamily:    inter ? 'Inter' : 'sans-serif',
              fontSize:      16,
              fontWeight:    400,
              color:         '#4DC5D2',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Career Bridge Verified Portfolio
          </div>
          <div
            style={{
              display:       'flex',
              fontFamily:    inter ? 'Inter' : 'sans-serif',
              fontSize:      14,
              color:         'rgba(255,255,255,0.3)',
              letterSpacing: '0.02em',
            }}
          >
            careerbridgefoundation.com/portfolio/{slug}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}

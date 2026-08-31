import { ImageResponse } from 'next/og';
import { getPortfolioBySlug } from '@/lib/portfolio/getPortfolioBySlug';
import { ROOT_DOMAIN } from '@/lib/partners/branding';
import { NAVY, TEAL } from '@/constants/colors';
import { loadGoogleFont } from '@/lib/og/loadGoogleFont';

export const alt = 'Evidentize Portfolio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Distinction':  { bg: '#1C1917', text: '#FBBF24', border: '#FBBF24' },
  'Merit':        { bg: NAVY, text: '#ffffff', border: 'rgba(255,255,255,0.4)' },
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
  const name     = data?.candidate.fullName ?? 'Evidentize Portfolio';
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
          background:     `linear-gradient(150deg, #22345c 0%, ${NAVY} 45%, #0d1730 100%)`,
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
              color:         TEAL,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Evidentize Verified Portfolio
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
            {ROOT_DOMAIN}/portfolio/{slug}
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

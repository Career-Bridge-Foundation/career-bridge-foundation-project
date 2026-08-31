import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og/loadGoogleFont';
import { NAVY } from '@/constants/colors';

export const alt = 'Evidentize';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Evidentize';

export default async function OgImage() {
  const [fraunces, inter] = await Promise.all([
    loadGoogleFont('Fraunces', 700),
    loadGoogleFont('Inter', 400),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: 'normal';
  }[] = [];
  if (fraunces) fonts.push({ name: 'Fraunces', data: fraunces, weight: 700, style: 'normal' });
  if (inter) fonts.push({ name: 'Inter', data: inter, weight: 400, style: 'normal' });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 20,
          padding: '64px 72px',
          background: `linear-gradient(150deg, #22345c 0%, ${NAVY} 45%, #0d1730 100%)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: fraunces ? 'Fraunces' : 'serif',
            fontSize: 76,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
          }}
        >
          {APP_NAME}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: inter ? 'Inter' : 'sans-serif',
            fontSize: 30,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 820,
            lineHeight: 1.4,
          }}
        >
          Practice into proof. Proof into portfolio.
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}

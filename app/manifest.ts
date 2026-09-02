import type { MetadataRoute } from 'next';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Evidentize';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Realistic workplace simulations, AI-evaluated, with a portfolio that proves what you can do.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf9',
    theme_color: '#18284e',
    icons: [
      { src: '/favicon.png', sizes: 'any', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}

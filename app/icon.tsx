import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Node runtime so the default icon can be read straight off disk instead of
// fetched over the network — keeps the neutral path fast and dependency-free.
export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

async function loadDefaultIcon(): Promise<string> {
  const bytes = await readFile(join(process.cwd(), 'public', 'evidentize-icon.png'));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

/**
 * Fetches the partner's uploaded icon and re-encodes it as a data URI so a
 * slow/broken remote host can never fail the icon route — same fail-closed
 * shape as resolvePartnerBranding(). Returns null on any failure.
 */
async function loadPartnerIcon(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Per-partner browser tab icon (Spec 05.4). Reads x-partner-logo-icon, set by
 * middleware from the request subdomain, and renders that partner's uploaded
 * icon slot — no separate favicon upload UI needed. Falls back to the
 * default Evidentize icon for the apex domain, an unresolved subdomain, or
 * any fetch failure.
 */
export default async function Icon() {
  const h = await headers();
  const partnerIconUrl = h.get('x-partner-logo-icon');

  const dataUri = (partnerIconUrl && (await loadPartnerIcon(partnerIconUrl))) || (await loadDefaultIcon());

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          width={size.width}
          height={size.height}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  );
}

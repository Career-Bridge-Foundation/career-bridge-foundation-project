export type RasterImageType = 'png' | 'jpeg' | 'webp'

const EXT: Record<RasterImageType, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }
const MIME: Record<RasterImageType, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }

/**
 * Detect PNG/JPEG/WebP from the leading bytes (magic numbers). Returns null for
 * anything else — including SVG and files whose declared Content-Type/extension
 * is spoofed. This is the SECURITY boundary: the branding bucket is public, so
 * only true raster images are accepted (no script-bearing SVG).
 */
export function sniffRasterImage(b: Uint8Array): RasterImageType | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png'
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  // WebP: "RIFF" .... "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp'
  return null
}

export const imageExt = (t: RasterImageType): string => EXT[t]
export const imageMime = (t: RasterImageType): string => MIME[t]

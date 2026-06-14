/**
 * Hand-rolled tests for sniffRasterImage (the SVG-rejection security boundary).
 * Run with: npx tsx lib/validation/imageType.test.ts
 * Exits 1 if any test fails, 0 if all pass.
 */

import { sniffRasterImage } from './imageType';

let passed = 0;
let failed = 0;

function assert(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const SVG = new Uint8Array([...'<svg xmlns="http://www.w3.org/2000/svg">'].map((c) => c.charCodeAt(0)));
const SVG_XML = new Uint8Array([...'<?xml version="1.0"?><svg>'].map((c) => c.charCodeAt(0)));
const TEXT = new Uint8Array([...'just some text pretending to be a png'].map((c) => c.charCodeAt(0)));
const EMPTY = new Uint8Array([]);
// RIFF container that is NOT webp (e.g. a WAV) — must not pass as webp.
const RIFF_WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);

console.log('\n── valid raster types ──');
assert('PNG magic → png', sniffRasterImage(PNG), 'png');
assert('JPEG magic → jpeg', sniffRasterImage(JPEG), 'jpeg');
assert('WebP magic → webp', sniffRasterImage(WEBP), 'webp');

console.log('\n── rejected (security boundary) ──');
assert('SVG <svg> → null', sniffRasterImage(SVG), null);
assert('SVG <?xml> → null', sniffRasterImage(SVG_XML), null);
assert('plain text (spoofed) → null', sniffRasterImage(TEXT), null);
assert('empty → null', sniffRasterImage(EMPTY), null);
assert('RIFF-but-WAV → null (not webp)', sniffRasterImage(RIFF_WAV), null);

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);

import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BASE_LENGTH = 45;
const COLLISION_SUFFIX_LENGTH = 4;
const MAX_RETRIES = 3;

/**
 * Pure slugification. Deterministic — same input always returns same output.
 * Implements spec Section 4 algorithm steps 1–2 + truncation step 3.
 *
 * Returns empty string for inputs that produce nothing slug-worthy
 * (e.g. all-CJK names, all-punctuation strings). Caller must handle that.
 */
export function slugifyName(name: string): string {
  if (!name) return '';

  return name
    // Unicode normalisation: split accented chars into base + combining marks
    .normalize('NFD')
    // Strip the combining marks (accents)
    .replace(/[̀-ͯ]/g, '')
    // Lowercase
    .toLowerCase()
    // Strip apostrophes and quotes outright (no hyphen): O'Connor → oconnor
    .replace(/['‘’"“”]/g, '')
    // Replace whitespace and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Strip anything that isn't alphanumeric or hyphen
    .replace(/[^a-z0-9-]/g, '')
    // Collapse consecutive hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Truncate to MAX_BASE_LENGTH (leaves room for collision suffix)
    .slice(0, MAX_BASE_LENGTH)
    // Re-trim hyphens in case truncation left a trailing one
    .replace(/-+$/, '');
}

/**
 * Random 4-char lowercase alphanumeric suffix. Used on slug collision.
 * Avoids ambiguous chars (no 'l', '1', 'o', '0') for human-readability.
 */
function randomSuffix(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < COLLISION_SUFFIX_LENGTH; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * UUID-derived fallback slug, used when:
 *   - slugifyName returns empty (e.g. CJK-only name)
 *   - 3 collision retries all fail
 */
function fallbackSlug(userId: string): string {
  return `u-${userId.replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Generate a unique slug and verify it's available in portfolio_profiles.
 * Implements spec Section 4 algorithm steps 3–5.
 *
 * Strategy:
 *   1. slugifyName(name) → base slug
 *   2. If empty, use fallbackSlug(userId)
 *   3. Check for collision in portfolio_profiles
 *   4. On collision, append -XXXX suffix and retry up to MAX_RETRIES times
 *   5. If all retries fail, return fallbackSlug(userId)
 *
 * NOTE: This function checks for collision but does NOT insert. The caller
 * (ensurePortfolioProfile in Step 3) is responsible for the actual insert.
 * Race condition: if two concurrent calls both check the same slug and both
 * see it as available, the second insert will fail on the UNIQUE constraint.
 * That's intentional — the insert error is caught by ensurePortfolioProfile.
 */
export async function generateUniqueSlug(
  name: string,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const base = slugifyName(name) || fallbackSlug(userId);

  // Try the bare base slug first
  if (await isSlugAvailable(base, supabase)) {
    return base;
  }

  // Collision: try with random suffix
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = `${base}-${randomSuffix()}`;
    if (await isSlugAvailable(candidate, supabase)) {
      return candidate;
    }
  }

  // All retries failed — fall back to UUID-derived slug
  // (Astronomically unlikely to collide; if it does, the insert will fail
  // and ensurePortfolioProfile will log the error.)
  return fallbackSlug(userId);
}

async function isSlugAvailable(
  slug: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('portfolio_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    // On query error, fail closed: treat as unavailable so caller retries
    // with a different slug rather than inserting a possibly-duplicate.
    console.error('[slug] isSlugAvailable query failed', { slug, error: error.message });
    return false;
  }

  return data === null;
}

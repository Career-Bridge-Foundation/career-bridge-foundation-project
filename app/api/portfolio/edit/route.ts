import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const HEADLINE_MAX     = 120;
const BIO_MAX          = 500;
const LOCATION_MAX     = 80;
const LINK_LABEL_MAX   = 30;
const MAX_LINKS        = 6;
const SIM_ID_MAX       = 200;
const ALLOWED_TEMPLATES = ['professional', 'focused'] as const;
type PortfolioTemplate = typeof ALLOWED_TEMPLATES[number];

type ExternalLink = { label: string; url: string };

type VisibilityRow = {
  simulation_id:     string;
  show_on_portfolio: boolean;
  show_scores:       boolean;
  show_feedback:     boolean;
};

function validateSimulationVisibility(
  raw: unknown,
): { ok: true; value: VisibilityRow[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'simulation_visibility must be an array' };

  const cleaned: VisibilityRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `simulation_visibility[${i}] must be an object` };
    }
    const obj = item as Record<string, unknown>;
    const simId = obj.simulation_id;

    if (typeof simId !== 'string' || !simId.trim()) {
      return { ok: false, error: `simulation_visibility[${i}].simulation_id must be a non-empty string` };
    }
    if (simId.length > SIM_ID_MAX) {
      return { ok: false, error: `simulation_visibility[${i}].simulation_id is too long` };
    }
    if (typeof obj.show_on_portfolio !== 'boolean') {
      return { ok: false, error: `simulation_visibility[${i}].show_on_portfolio must be boolean` };
    }
    if (typeof obj.show_scores !== 'boolean') {
      return { ok: false, error: `simulation_visibility[${i}].show_scores must be boolean` };
    }
    if (typeof obj.show_feedback !== 'boolean') {
      return { ok: false, error: `simulation_visibility[${i}].show_feedback must be boolean` };
    }
    if (seen.has(simId)) {
      return { ok: false, error: `simulation_visibility contains duplicate simulation_id "${simId}"` };
    }
    seen.add(simId);

    cleaned.push({
      simulation_id:     simId.trim(),
      show_on_portfolio: obj.show_on_portfolio,
      show_scores:       obj.show_scores,
      show_feedback:     obj.show_feedback,
    });
  }

  return { ok: true, value: cleaned };
}

function validateExternalLinks(
  raw: unknown,
): { ok: true; value: ExternalLink[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'external_links must be an array' };

  const cleaned: ExternalLink[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `external_links[${i}] must be an object` };
    }
    const label = (item as { label?: unknown }).label;
    const url   = (item as { url?: unknown }).url;

    if (typeof label !== 'string' || typeof url !== 'string') {
      return { ok: false, error: `external_links[${i}] must have string label and url` };
    }

    const labelTrim = label.trim();
    const urlTrim   = url.trim();

    // Defensive: silently drop fully blank rows that slipped past the client.
    if (!labelTrim && !urlTrim) continue;

    if (!labelTrim) return { ok: false, error: `external_links[${i}].label is required` };
    if (labelTrim.length > LINK_LABEL_MAX) {
      return { ok: false, error: `external_links[${i}].label must be ${LINK_LABEL_MAX} characters or fewer` };
    }
    if (!urlTrim) return { ok: false, error: `external_links[${i}].url is required` };
    if (!/^https?:\/\//i.test(urlTrim)) {
      return { ok: false, error: `external_links[${i}].url must start with http:// or https://` };
    }

    cleaned.push({ label: labelTrim, url: urlTrim });
  }

  if (cleaned.length > MAX_LINKS) {
    return { ok: false, error: `external_links must have at most ${MAX_LINKS} items` };
  }

  return { ok: true, value: cleaned };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateOptionalString(
  value: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: `${field} must be a string` };
  }
  if (value.length > max) {
    return { ok: false, error: `${field} must be ${max} characters or fewer` };
  }
  return { ok: true, value };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const headline = validateOptionalString(body.headline, 'headline', HEADLINE_MAX);
  if (!headline.ok) return json({ error: headline.error }, 400);

  const bio = validateOptionalString(body.bio, 'bio', BIO_MAX);
  if (!bio.ok) return json({ error: bio.error }, 400);

  const location = validateOptionalString(body.location, 'location', LOCATION_MAX);
  if (!location.ok) return json({ error: location.error }, 400);

  const linkedin = validateOptionalString(body.linkedin_url, 'linkedin_url', 2048);
  if (!linkedin.ok) return json({ error: linkedin.error }, 400);

  if (linkedin.value && !/^https?:\/\//i.test(linkedin.value)) {
    return json({ error: 'linkedin_url must start with http:// or https://' }, 400);
  }

  const externalLinks = validateExternalLinks(body.external_links);
  if (!externalLinks.ok) return json({ error: externalLinks.error }, 400);

  const visibility = validateSimulationVisibility(body.simulation_visibility);
  if (!visibility.ok) return json({ error: visibility.error }, 400);

  let template: PortfolioTemplate | undefined;
  if (body.template !== undefined && body.template !== null) {
    if (!ALLOWED_TEMPLATES.includes(body.template as PortfolioTemplate)) {
      return json({ error: `template must be one of: ${ALLOWED_TEMPLATES.join(', ')}` }, 400);
    }
    template = body.template as PortfolioTemplate;
  }

  // UPDATE only the allowed fields. user_id, slug, and is_public are
  // intentionally excluded — they are not editable here.
  const { error } = await supabase
    .from('portfolio_profiles')
    .update({
      headline:       headline.value,
      bio:            bio.value,
      location:       location.value,
      linkedin_url:   linkedin.value,
      external_links: externalLinks.value,
      ...(template !== undefined && { template }),
    })
    .eq('user_id', user.id);

  if (error) {
    return json({ error: error.message }, 500);
  }

  // Per-simulation visibility upserts. Each row is scoped to the
  // authenticated user — RLS policies on portfolio_simulation_visibility
  // (owner_insert / owner_update) ensure user.id must equal user_id.
  // Defaults: rows are lazy-created only when the candidate has touched
  // a toggle, so an empty visibility table = everything visible.
  if (visibility.value.length > 0) {
    const rows = visibility.value.map((v) => ({
      user_id:           user.id,
      simulation_id:     v.simulation_id,
      show_on_portfolio: v.show_on_portfolio,
      show_scores:       v.show_scores,
      show_feedback:     v.show_feedback,
    }));

    const { error: visError } = await supabase
      .from('portfolio_simulation_visibility')
      .upsert(rows, { onConflict: 'user_id,simulation_id' });

    if (visError) {
      return json({ error: visError.message }, 500);
    }
  }

  return json({ success: true }, 200);
}

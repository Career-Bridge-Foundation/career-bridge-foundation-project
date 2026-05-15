import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TITLE_MAX        = 100;
const DESCRIPTION_MAX  = 300;
const SORT_ORDER_MAX   = 100_000;
const STORAGE_BUCKET   = 'portfolio-evidence';
const STORAGE_MARKER   = '/portfolio-evidence/';

const FORBIDDEN_PATCH_FIELDS = [
  'file_url',
  'external_url',
  'evidence_type',
  'simulation_id',
  'user_id',
  'session_id',
] as const;

type EvidenceRow = {
  id:            string;
  user_id:       string;
  simulation_id: string;
  session_id:    string | null;
  title:         string;
  description:   string | null;
  evidence_type: 'image' | 'pdf' | 'document' | 'link';
  file_url:      string | null;
  external_url:  string | null;
  is_visible:    boolean;
  sort_order:    number;
  uploaded_at:   string;
};

type PatchUpdates = {
  title?:       string;
  description?: string | null;
  sort_order?:  number;
  is_visible?:  boolean;
};

type ValidationResult =
  | { ok: true; value: PatchUpdates }
  | { ok: false; status: number; error: string };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validatePatchBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object' };
  }
  const body = raw as Record<string, unknown>;

  for (const forbidden of FORBIDDEN_PATCH_FIELDS) {
    if (forbidden in body) {
      return {
        ok: false,
        status: 400,
        error: `Field "${forbidden}" cannot be updated`,
      };
    }
  }

  const updates: PatchUpdates = {};

  if ('title' in body) {
    const t = body.title;
    if (typeof t !== 'string') {
      return { ok: false, status: 400, error: 'title must be a string' };
    }
    const trimmed = t.trim();
    if (!trimmed) {
      return { ok: false, status: 400, error: 'title is required' };
    }
    if (trimmed.length > TITLE_MAX) {
      return {
        ok: false,
        status: 400,
        error: `title must be ${TITLE_MAX} characters or fewer`,
      };
    }
    updates.title = trimmed;
  }

  if ('description' in body) {
    const d = body.description;
    if (d === null) {
      updates.description = null;
    } else if (typeof d !== 'string') {
      return { ok: false, status: 400, error: 'description must be a string or null' };
    } else {
      const trimmed = d.trim();
      if (!trimmed) {
        updates.description = null;
      } else if (trimmed.length > DESCRIPTION_MAX) {
        return {
          ok: false,
          status: 400,
          error: `description must be ${DESCRIPTION_MAX} characters or fewer`,
        };
      } else {
        updates.description = trimmed;
      }
    }
  }

  if ('sort_order' in body) {
    const s = body.sort_order;
    if (typeof s !== 'number' || !Number.isInteger(s)) {
      return { ok: false, status: 400, error: 'sort_order must be an integer' };
    }
    if (s < 0 || s > SORT_ORDER_MAX) {
      return {
        ok: false,
        status: 400,
        error: `sort_order must be between 0 and ${SORT_ORDER_MAX}`,
      };
    }
    updates.sort_order = s;
  }

  if ('is_visible' in body) {
    const v = body.is_visible;
    if (typeof v !== 'boolean') {
      return { ok: false, status: 400, error: 'is_visible must be a boolean' };
    }
    updates.is_visible = v;
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'At least one updatable field is required',
    };
  }

  return { ok: true, value: updates };
}

function extractStoragePath(fileUrl: string): string | null {
  const idx = fileUrl.indexOf(STORAGE_MARKER);
  if (idx < 0) return null;
  const after = fileUrl.substring(idx + STORAGE_MARKER.length);
  const qIdx  = after.indexOf('?');
  const clean = qIdx >= 0 ? after.substring(0, qIdx) : after;
  return clean || null;
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const { id } = await ctx.params;

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const validated = validatePatchBody(parsed);
  if (!validated.ok) return json({ error: validated.error }, validated.status);

  const { data: existing, error: lookupError } = await supabase
    .from('portfolio_evidence')
    .select('id')
    .eq('id',      id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupError) {
    console.error('[portfolio/evidence PATCH lookup]', {
      user_id: user.id,
      route:   `PATCH /api/portfolio/evidence/${id}`,
      error:   lookupError.message,
    });
    return json({ error: 'Failed to load evidence' }, 500);
  }

  if (!existing) {
    return json({ error: 'Evidence not found' }, 404);
  }

  const { data: updated, error: updateError } = await supabase
    .from('portfolio_evidence')
    .update(validated.value)
    .eq('id',      id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (updateError) {
    console.error('[portfolio/evidence PATCH update]', {
      user_id: user.id,
      route:   `PATCH /api/portfolio/evidence/${id}`,
      error:   updateError.message,
    });
    return json({ error: 'Failed to update evidence' }, 500);
  }

  return json({ evidence: updated }, 200);
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const { id } = await ctx.params;

  const { data: row, error: lookupError } = await supabase
    .from('portfolio_evidence')
    .select('id, evidence_type, file_url')
    .eq('id',      id)
    .eq('user_id', user.id)
    .maybeSingle<Pick<EvidenceRow, 'id' | 'evidence_type' | 'file_url'>>();

  if (lookupError) {
    console.error('[portfolio/evidence DELETE lookup]', {
      user_id: user.id,
      route:   `DELETE /api/portfolio/evidence/${id}`,
      error:   lookupError.message,
    });
    return json({ error: 'Failed to load evidence' }, 500);
  }

  if (!row) {
    return json({ error: 'Evidence not found' }, 404);
  }

  if (
    (row.evidence_type === 'image' || row.evidence_type === 'pdf' || row.evidence_type === 'document')
    && row.file_url
  ) {
    const path = extractStoragePath(row.file_url);
    if (path) {
      const { error: storageError } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .remove([path]);

      if (storageError) {
        console.error('[portfolio/evidence DELETE storage]', {
          user_id: user.id,
          route:   `DELETE /api/portfolio/evidence/${id}`,
          path,
          error:   storageError.message,
        });
      }
    } else {
      console.error('[portfolio/evidence DELETE storage path]', {
        user_id: user.id,
        route:   `DELETE /api/portfolio/evidence/${id}`,
        file_url: row.file_url,
        error:    'Could not extract storage path from file_url',
      });
    }
  }

  const { error: deleteError } = await supabase
    .from('portfolio_evidence')
    .delete()
    .eq('id',      id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[portfolio/evidence DELETE row]', {
      user_id: user.id,
      route:   `DELETE /api/portfolio/evidence/${id}`,
      error:   deleteError.message,
    });
    return json({ error: 'Failed to delete evidence' }, 500);
  }

  return new Response(null, { status: 204 });
}

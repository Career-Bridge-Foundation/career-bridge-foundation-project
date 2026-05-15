import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TITLE_MAX            = 100;
const DESCRIPTION_MAX      = 300;
const SIM_ID_MAX           = 200;
const SORT_ORDER_MAX       = 100_000;
const FILE_SIZE_MAX        = 25 * 1024 * 1024;
const MAX_PER_SIMULATION   = 5;
const STORAGE_BUCKET       = 'portfolio-evidence';

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PDF_MIME   = new Set(['application/pdf']);
const DOC_MIME   = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

type EvidenceType = 'image' | 'pdf' | 'document' | 'link';

type ValidatedString =
  | { ok: true; value: string }
  | { ok: false; error: string };

type ValidatedNullableString =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

type ValidatedBoolean =
  | { ok: true; value: boolean }
  | { ok: false; error: string };

type ValidatedInt =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateTitle(raw: unknown): ValidatedString {
  if (typeof raw !== 'string') return { ok: false, error: 'title is required' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'title is required' };
  if (trimmed.length > TITLE_MAX) {
    return { ok: false, error: `title must be ${TITLE_MAX} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

function validateDescription(raw: unknown): ValidatedNullableString {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'description must be a string' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > DESCRIPTION_MAX) {
    return { ok: false, error: `description must be ${DESCRIPTION_MAX} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

function validateSimulationId(raw: unknown): ValidatedString {
  if (typeof raw !== 'string') return { ok: false, error: 'simulation_id is required' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'simulation_id is required' };
  if (trimmed.length > SIM_ID_MAX) {
    return { ok: false, error: `simulation_id must be ${SIM_ID_MAX} characters or fewer` };
  }
  return { ok: true, value: trimmed };
}

function validateBooleanField(
  raw: unknown,
  field: string,
  defaultValue: boolean,
): ValidatedBoolean {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: defaultValue };
  }
  if (typeof raw === 'boolean') return { ok: true, value: raw };
  if (raw === 'true')  return { ok: true, value: true };
  if (raw === 'false') return { ok: true, value: false };
  return { ok: false, error: `${field} must be a boolean` };
}

function validateIntField(raw: unknown, field: string): ValidatedInt {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }
  const asNumber = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(asNumber)) {
    return { ok: false, error: `${field} must be an integer` };
  }
  if (asNumber < 0 || asNumber > SORT_ORDER_MAX) {
    return { ok: false, error: `${field} must be between 0 and ${SORT_ORDER_MAX}` };
  }
  return { ok: true, value: asNumber };
}

function validateUuid(raw: unknown, field: string): ValidatedNullableString {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: `${field} must be a string` };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(trimmed)) return { ok: false, error: `${field} must be a valid UUID` };
  return { ok: true, value: trimmed };
}

function mimeToEvidenceType(mime: string): EvidenceType | null {
  if (IMAGE_MIME.has(mime)) return 'image';
  if (PDF_MIME.has(mime))   return 'pdf';
  if (DOC_MIME.has(mime))   return 'document';
  return null;
}

function extFromFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) return 'bin';
  return name.substring(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const simulationId = request.nextUrl.searchParams.get('simulation_id');

  let query = supabase
    .from('portfolio_evidence')
    .select('*')
    .eq('user_id', user.id)
    .order('simulation_id', { ascending: true })
    .order('sort_order',    { ascending: true });

  if (simulationId && simulationId.trim()) {
    query = query.eq('simulation_id', simulationId.trim());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[portfolio/evidence GET]', { user_id: user.id, error: error.message });
    return json({ error: 'Failed to load evidence' }, 500);
  }

  return json({ evidence: data ?? [] }, 200);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Request must be multipart/form-data' }, 400);
  }

  const simId = validateSimulationId(formData.get('simulation_id'));
  if (!simId.ok) return json({ error: simId.error }, 400);

  const title = validateTitle(formData.get('title'));
  if (!title.ok) return json({ error: title.error }, 400);

  const description = validateDescription(formData.get('description'));
  if (!description.ok) return json({ error: description.error }, 400);

  const sessionId = validateUuid(formData.get('session_id'), 'session_id');
  if (!sessionId.ok) return json({ error: sessionId.error }, 400);

  const isVisible = validateBooleanField(formData.get('is_visible'), 'is_visible', true);
  if (!isVisible.ok) return json({ error: isVisible.error }, 400);

  const sortOrder = validateIntField(formData.get('sort_order'), 'sort_order');
  if (!sortOrder.ok) return json({ error: sortOrder.error }, 400);

  const fileField = formData.get('file');
  const urlField  = formData.get('url');

  const hasFile = fileField instanceof File && fileField.size > 0;
  const hasUrl  = typeof urlField === 'string' && urlField.trim().length > 0;

  if (hasFile && hasUrl) {
    return json({ error: 'Provide either a file or a URL, not both' }, 400);
  }
  if (!hasFile && !hasUrl) {
    return json({ error: 'Provide either a file or a URL' }, 400);
  }

  // Enforce the per-simulation cap before any storage work.
  const { count: existingCount, error: countError } = await supabase
    .from('portfolio_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('user_id',       user.id)
    .eq('simulation_id', simId.value);

  if (countError) {
    console.error('[portfolio/evidence POST count]', {
      user_id: user.id,
      route:   'POST /api/portfolio/evidence',
      error:   countError.message,
    });
    return json({ error: 'Failed to count existing evidence' }, 500);
  }

  if ((existingCount ?? 0) >= MAX_PER_SIMULATION) {
    return json(
      { error: 'Maximum 5 evidence items per simulation. Remove one to add another.' },
      409,
    );
  }

  let resolvedSortOrder = sortOrder.value;
  if (resolvedSortOrder === null) {
    const { data: maxRow, error: maxError } = await supabase
      .from('portfolio_evidence')
      .select('sort_order')
      .eq('user_id',       user.id)
      .eq('simulation_id', simId.value)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error('[portfolio/evidence POST max sort_order]', {
        user_id: user.id,
        route:   'POST /api/portfolio/evidence',
        error:   maxError.message,
      });
      return json({ error: 'Failed to compute sort order' }, 500);
    }

    resolvedSortOrder = (maxRow?.sort_order ?? -1) + 1;
  }

  // ── URL submission flow ─────────────────────────────────────
  if (hasUrl) {
    const urlTrim = (urlField as string).trim();
    if (!/^https?:\/\//i.test(urlTrim)) {
      return json({ error: 'URL must start with http:// or https://' }, 400);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('portfolio_evidence')
      .insert({
        user_id:       user.id,
        simulation_id: simId.value,
        session_id:    sessionId.value,
        title:         title.value,
        description:   description.value,
        evidence_type: 'link',
        file_url:      null,
        external_url:  urlTrim,
        is_visible:    isVisible.value,
        sort_order:    resolvedSortOrder,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[portfolio/evidence POST url insert]', {
        user_id: user.id,
        route:   'POST /api/portfolio/evidence',
        error:   insertError.message,
      });
      return json({ error: 'Failed to save evidence' }, 500);
    }

    return json({ evidence: inserted }, 201);
  }

  // ── File upload flow ────────────────────────────────────────
  const file = fileField as File;

  if (file.size > FILE_SIZE_MAX) {
    return json({ error: 'File size exceeds 25MB limit.' }, 413);
  }

  const evidenceType = mimeToEvidenceType(file.type);
  if (!evidenceType) {
    return json(
      { error: 'File type not allowed. Permitted: PNG, JPG, WEBP, PDF, DOCX, PPTX, XLSX.' },
      415,
    );
  }

  const evidenceId = crypto.randomUUID();
  const ext        = extFromFileName(file.name);
  const path       = `${user.id}/${evidenceId}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert:      false,
    });

  if (uploadError) {
    console.error('[portfolio/evidence POST upload]', {
      user_id: user.id,
      route:   'POST /api/portfolio/evidence',
      error:   uploadError.message,
    });
    return json({ error: 'Failed to upload file' }, 500);
  }

  const { data: publicUrlData } = supabase
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  const publicUrl = publicUrlData.publicUrl;

  const { data: inserted, error: insertError } = await supabase
    .from('portfolio_evidence')
    .insert({
      id:            evidenceId,
      user_id:       user.id,
      simulation_id: simId.value,
      session_id:    sessionId.value,
      title:         title.value,
      description:   description.value,
      evidence_type: evidenceType,
      file_url:      publicUrl,
      external_url:  null,
      is_visible:    isVisible.value,
      sort_order:    resolvedSortOrder,
    })
    .select('*')
    .single();

  if (insertError) {
    // Best-effort cleanup of the orphaned upload.
    const { error: cleanupError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (cleanupError) {
      console.error('[portfolio/evidence POST cleanup failed]', {
        user_id: user.id,
        route:   'POST /api/portfolio/evidence',
        path,
        error:   cleanupError.message,
      });
    }

    console.error('[portfolio/evidence POST file insert]', {
      user_id: user.id,
      route:   'POST /api/portfolio/evidence',
      error:   insertError.message,
    });
    return json({ error: 'Failed to save evidence' }, 500);
  }

  return json({ evidence: inserted }, 201);
}

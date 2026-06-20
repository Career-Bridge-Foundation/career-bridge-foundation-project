import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/supabase/log-activity'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Criterion {
  name: string
  description?: string
  max_points: number
}

interface VerdictBands {
  Distinction: number
  Merit: number
  Pass: number
}

interface ValidatedRubricBody {
  system_prompt: string
  model: string
  criteria: Criterion[]
  verdict_bands: VerdictBands
  scoring_scale: Record<string, string> | null
  output_instructions: string | null
  max_score: number
}

// ── Hand-rolled validator (no Zod) ────────────────────────────────────────────

const ALLOWED_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]

const DEFAULT_SCORING_SCALE: Record<string, string> = {
  '1': 'Weak',
  '2': 'Competent',
  '3': 'Strong',
}

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function validateRubricBody(raw: unknown): ValidationResult<ValidatedRubricBody> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Request body must be an object' }
  }
  const body = raw as Record<string, unknown>

  if (typeof body.system_prompt !== 'string' || !body.system_prompt.trim()) {
    return { ok: false, error: 'system_prompt is required' }
  }

  if (typeof body.model !== 'string' || !ALLOWED_MODELS.includes(body.model)) {
    return { ok: false, error: `model must be one of: ${ALLOWED_MODELS.join(', ')}` }
  }

  if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
    return { ok: false, error: 'criteria must be a non-empty array' }
  }
  for (let i = 0; i < body.criteria.length; i++) {
    const c = body.criteria[i]
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      return { ok: false, error: `criteria[${i}] must be an object` }
    }
    const cr = c as Record<string, unknown>
    if (typeof cr.name !== 'string' || !cr.name.trim()) {
      return { ok: false, error: `criteria[${i}].name is required` }
    }
    if (
      typeof cr.max_points !== 'number' ||
      !Number.isInteger(cr.max_points) ||
      cr.max_points < 1
    ) {
      return { ok: false, error: `criteria[${i}].max_points must be a positive integer` }
    }
  }

  const vb = body.verdict_bands
  if (!vb || typeof vb !== 'object' || Array.isArray(vb)) {
    return { ok: false, error: 'verdict_bands must be an object' }
  }
  const { Distinction, Merit, Pass } = vb as Record<string, unknown>
  if (typeof Distinction !== 'number' || typeof Merit !== 'number' || typeof Pass !== 'number') {
    return { ok: false, error: 'verdict_bands must have Distinction, Merit, Pass as numbers' }
  }
  if (!(Distinction > Merit && Merit > Pass && Pass >= 0 && Distinction <= 100)) {
    return {
      ok: false,
      error: 'verdict_bands thresholds must satisfy: Distinction > Merit > Pass ≥ 0, all ≤ 100',
    }
  }

  const max_score = (body.criteria as Criterion[]).reduce((sum, c) => sum + c.max_points, 0)

  const scoring_scale =
    body.scoring_scale &&
    typeof body.scoring_scale === 'object' &&
    !Array.isArray(body.scoring_scale)
      ? (body.scoring_scale as Record<string, string>)
      : DEFAULT_SCORING_SCALE

  const output_instructions =
    typeof body.output_instructions === 'string'
      ? body.output_instructions.trim()
      : ''

  return {
    ok: true,
    data: {
      system_prompt: body.system_prompt.trim(),
      model: body.model,
      criteria: body.criteria as Criterion[],
      verdict_bands: { Distinction, Merit, Pass } as VerdictBands,
      scoring_scale,
      output_instructions,
      max_score,
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCallerEmail(request: NextRequest): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.email ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const { data, error } = await supabaseServer
    .from('rubrics')
    .select(
      'id, version, system_prompt, model, max_score, is_active, criteria, verdict_bands, scoring_scale, output_instructions'
    )
    .eq('simulation_slug', slug)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rubrics: data ?? [] })
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = validateRubricBody(raw)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const { system_prompt, model, criteria, verdict_bands, scoring_scale, output_instructions, max_score } = result.data

  // Resolve simulation_id from slug (required NOT NULL column)
  const { data: sim, error: simErr } = await supabaseServer
    .from('simulations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (simErr || !sim) {
    return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
  }

  // Determine next version
  const { data: existing } = await supabaseServer
    .from('rubrics')
    .select('version')
    .eq('simulation_slug', slug)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

  // Deactivate all existing rubrics for this simulation
  const { error: deactivateErr } = await supabaseServer
    .from('rubrics')
    .update({ is_active: false })
    .eq('simulation_slug', slug)

  if (deactivateErr) {
    return NextResponse.json({ error: deactivateErr.message }, { status: 500 })
  }

  // Insert new active version with all required fields
  const { data: newRubric, error: insertErr } = await supabaseServer
    .from('rubrics')
    .insert({
      simulation_id: sim.id,
      simulation_slug: slug,
      version: nextVersion,
      system_prompt,
      model,
      criteria,
      verdict_bands,
      scoring_scale,
      output_instructions,
      max_score,
      is_active: true,
    })
    .select(
      'id, version, system_prompt, model, max_score, is_active, criteria, verdict_bands, scoring_scale, output_instructions'
    )
    .single()

  if (insertErr || !newRubric) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  const email = await getCallerEmail(request)
  logActivity({
    simulationId: sim.id,
    userEmail: email,
    action: 'updated_rubric',
    diff: { version: nextVersion, model, max_score, criteria_count: criteria.length },
  })

  return NextResponse.json({ rubric: newRubric })
}

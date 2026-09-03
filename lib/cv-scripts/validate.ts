import { supabaseServer } from '@/lib/supabase/server';
import { verdictRank, type VerdictBand } from '@/lib/verdict-bands';
import { BAND_VOCABULARY } from './buildPrompt';
import type { GenerationInput } from './buildGenerationInput';
import type { CvScriptFormats } from './types';

// Spec 17 locked answer #6: a blocklist of inflationary words, applied only
// at low completed_count — deterministic, no numeric "consistency" model.
const VOLUME_INFLATION_WORDS = [
  'extensive',
  'numerous',
  'wide range',
  'significant',
  'broad range',
  'countless',
  'vast',
];

const METRIC_PATTERN = /(\d+(\.\d+)?\s?%)|[£$€]\s?\d/;
const BARE_DIGIT_PATTERN = /\b\d+\b/g;

function allTextFields(formats: Partial<CvScriptFormats>): string[] {
  const out: string[] = [];
  if (formats.cv_bullet) out.push(formats.cv_bullet);
  if (formats.cv_summary) out.push(formats.cv_summary);
  if (formats.linkedin_about) out.push(formats.linkedin_about);
  if (formats.linkedin_project) {
    if (formats.linkedin_project.title) out.push(formats.linkedin_project.title);
    if (formats.linkedin_project.description) out.push(formats.linkedin_project.description);
  }
  return out;
}

function checkMetrics(texts: string[], input: GenerationInput): string[] {
  const allowedNumbers = new Set<string>([String(input.completedCount)]);
  for (const d of input.dimensionScores) allowedNumbers.add(String(d.score));

  const reasons: string[] = [];
  for (const text of texts) {
    if (METRIC_PATTERN.test(text)) {
      reasons.push(`percentage/currency figure found in: "${text}"`);
    }
    const digits = text.match(BARE_DIGIT_PATTERN) ?? [];
    for (const d of digits) {
      if (!allowedNumbers.has(d)) {
        reasons.push(`unexplained number "${d}" found in: "${text}"`);
      }
    }
  }
  return reasons;
}

// Spec 17 locked answer #5: simulations.company substring match only for v1
// (no alias table).
function checkEmployerLeak(texts: string[], companyName: string | null): string[] {
  if (!companyName) return [];
  const needle = companyName.toLowerCase();
  const reasons: string[] = [];
  for (const text of texts) {
    if (text.toLowerCase().includes(needle)) {
      reasons.push(`employer name "${companyName}" leaked in: "${text}"`);
    }
  }
  return reasons;
}

async function checkPartnerLeak(texts: string[]): Promise<string[]> {
  const { data: partners } = await supabaseServer.from('partners').select('name, legal_entity_name');
  const names = (partners ?? [])
    .flatMap((p) => [p.name, p.legal_entity_name])
    .filter((n): n is string => !!n && n.length > 2);

  const reasons: string[] = [];
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const name of names) {
      if (lower.includes(name.toLowerCase())) {
        reasons.push(`partner name "${name}" leaked in: "${text}"`);
      }
    }
  }
  return reasons;
}

function checkBandInflation(texts: string[], band: string): string[] {
  const bandRank = verdictRank(band);
  const reasons: string[] = [];

  for (const [tier, adjectives] of Object.entries(BAND_VOCABULARY) as [VerdictBand, string[]][]) {
    if (verdictRank(tier) <= bandRank) continue; // not a higher tier than what was achieved
    for (const adj of adjectives) {
      for (const text of texts) {
        if (text.toLowerCase().includes(adj.toLowerCase())) {
          reasons.push(`${tier}-tier language ("${adj}") used for a ${band} result: "${text}"`);
        }
      }
    }
  }
  return reasons;
}

function checkVolumeInflation(texts: string[], completedCount: number): string[] {
  if (completedCount > 3) return [];
  const reasons: string[] = [];
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const word of VOLUME_INFLATION_WORDS) {
      if (lower.includes(word)) {
        reasons.push(`inflationary volume language ("${word}") used with only ${completedCount} completed: "${text}"`);
      }
    }
  }
  return reasons;
}

export async function runValidationGuard(
  formats: Partial<CvScriptFormats>,
  input: GenerationInput,
  companyName: string | null
): Promise<{ ok: true } | { ok: false; reasons: string[] }> {
  const texts = allTextFields(formats);
  const reasons = [
    ...checkMetrics(texts, input),
    ...checkEmployerLeak(texts, companyName),
    ...(await checkPartnerLeak(texts)),
    ...checkBandInflation(texts, input.verdictBand),
    ...checkVolumeInflation(texts, input.completedCount),
  ];
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

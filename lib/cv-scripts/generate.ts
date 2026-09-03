import Anthropic from '@anthropic-ai/sdk';
import { buildSimulationBulletPrompt, buildDisciplineSummaryPrompt } from './buildPrompt';
import type { GenerationInput } from './buildGenerationInput';
import type { CvScriptFormats } from './types';

// No shared Anthropic client module exists in this codebase — each call site
// (app/api/evaluate/route.ts, lib/debrief/generateSummary.ts) instantiates
// its own. Matching that convention here.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same brace-scanning extraction as app/api/evaluate/route.ts — more robust
// than a markdown-fence strip, and this output needs strict parsing since
// the validation guard runs against the parsed fields.
function extractJson(rawContent: string): Record<string, unknown> {
  const firstBrace = rawContent.indexOf('{');
  if (firstBrace === -1) throw new Error('No JSON object found in Claude response');

  let parsed: Record<string, unknown> | null = null;
  let lastBrace = rawContent.lastIndexOf('}');
  while (lastBrace > firstBrace) {
    try {
      parsed = JSON.parse(rawContent.slice(firstBrace, lastBrace + 1));
      break;
    } catch {
      lastBrace = rawContent.lastIndexOf('}', lastBrace - 1);
    }
  }
  if (parsed === null) throw new Error('No parseable JSON object found in Claude response');
  return parsed;
}

async function callClaude(system: string, user: string): Promise<Record<string, unknown>> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned no text content for cv-script generation');
  }
  return extractJson(block.text);
}

export async function generateSimulationBullet(
  input: GenerationInput
): Promise<Pick<CvScriptFormats, 'cv_bullet'>> {
  const { system, user } = buildSimulationBulletPrompt(input);
  const parsed = await callClaude(system, user);
  return { cv_bullet: String(parsed.cv_bullet ?? '') };
}

export async function generateDisciplineSummary(
  input: GenerationInput
): Promise<Pick<CvScriptFormats, 'cv_summary' | 'linkedin_project' | 'linkedin_about'>> {
  const { system, user } = buildDisciplineSummaryPrompt(input);
  const parsed = await callClaude(system, user);
  return {
    cv_summary: String(parsed.cv_summary ?? ''),
    linkedin_project: parsed.linkedin_project as CvScriptFormats['linkedin_project'],
    linkedin_about: String(parsed.linkedin_about ?? ''),
  };
}

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServerClient, supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PRACTICE_ASSISTANT_MODEL =
  process.env.PRACTICE_ASSISTANT_MODEL ?? "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are giving lightweight qualitative feedback on a free Practice Trial simulation task for Evidentize Portfolio Simulations.

This is NOT a professional assessment. You must NOT produce a score, band, verdict, or readiness figure of any kind — the platform's structural guarantee is that Practice Trials can never produce one, even if asked to.

Give:
- One named strength (specific to what the candidate actually wrote, not generic praise)
- Two specific gaps at the dimension level (concrete, actionable, tied to the task)

Respond with ONLY a JSON object of this exact shape, no markdown fences, no other text:
{"strength": "...", "gaps": ["...", "..."]}`;

interface TaskInput {
  taskId: number;
  title: string;
  response: string;
}

type PracticeFeedback = { strength: string; gaps: [string, string] };

function parseFeedbackJson(raw: string): PracticeFeedback | null {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    if (
      typeof parsed.strength === "string" &&
      Array.isArray(parsed.gaps) &&
      parsed.gaps.length === 2 &&
      parsed.gaps.every((g: unknown) => typeof g === "string")
    ) {
      return { strength: parsed.strength, gaps: [parsed.gaps[0], parsed.gaps[1]] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/practice/runs/:id/submit
 *
 * Generates isolated, qualitative-only feedback for a Practice Trial run.
 * This route deliberately does NOT call getActiveRubric, does not write to
 * evaluation_results, does not call ensurePortfolioProfile (already exists
 * by this point — the run couldn't have been created otherwise), and never
 * touches lib/verdict-bands.ts or the certifier issuance route (Spec 14
 * decision 7's structural isolation).
 *
 * Body: { responses: { taskId: number, title: string, response: string }[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({ key: `practice-submit:${user.id}`, limit: 10, windowMs: 5 * 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: portfolio } = await supabaseServer
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: run } = await supabaseServer
    .from("practice_runs")
    .select("id, submitted_at, feedback")
    .eq("id", runId)
    .eq("candidate_id", portfolio.id)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Idempotent: a run already submitted returns its existing feedback rather
  // than spending another Claude call.
  if (run.submitted_at && run.feedback) {
    return NextResponse.json({ feedback: run.feedback });
  }

  let body: { responses?: TaskInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { responses } = body;
  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return NextResponse.json({ error: "Missing or empty 'responses' array" }, { status: 400 });
  }

  const taskText = responses
    .map((t) => `TASK ${t.taskId} — ${t.title}\n${"─".repeat(40)}\n${t.response.trim()}`)
    .join("\n\n");

  let feedback: PracticeFeedback;

  try {
    const message = await client.messages.create({
      model: PRACTICE_ASSISTANT_MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Here is the candidate's practice run:\n\n${taskText}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      return NextResponse.json({ error: "Claude returned an unexpected response" }, { status: 500 });
    }

    const parsed = parseFeedbackJson(block.text);
    if (!parsed) {
      console.error("[practice/submit] failed to parse feedback JSON:", block.text);
      return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 });
    }
    feedback = parsed;
  } catch (err) {
    console.error("[practice/submit] Claude API call failed:", err);
    return NextResponse.json({ error: "Claude API call failed" }, { status: 500 });
  }

  const { error: updateError } = await supabaseServer
    .from("practice_runs")
    .update({ feedback, submitted_at: new Date().toISOString() })
    .eq("id", runId);

  if (updateError) {
    console.error("[practice/submit] update failed:", updateError.message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  return NextResponse.json({ feedback });
}

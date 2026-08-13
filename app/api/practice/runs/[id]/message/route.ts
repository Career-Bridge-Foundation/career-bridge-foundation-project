import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient as createSupabaseServerClient, supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Spec 14 decision 4: the practice assistant runs on the lightweight model,
// not the production evaluator model — this is the primary lever bounding
// free-tier inference cost. Configurable so it can be bumped independent of
// the assessed evaluator model without a code change.
const PRACTICE_ASSISTANT_MODEL =
  process.env.PRACTICE_ASSISTANT_MODEL ?? "claude-haiku-4-5-20251001";

// Spec 14 decision 5 + open question 1: fixed default until usage data exists
// to set it at ~75th percentile of assessed-run usage (see spec's open
// questions). Configurable without a deploy.
const PRACTICE_MESSAGE_CAP = Number(process.env.PRACTICE_MESSAGE_CAP ?? 20);

/**
 * POST /api/practice/runs/:id/message
 *
 * Assistant turn for a Practice Trial, mirroring app/api/chat/route.ts's
 * streaming pattern but with two differences required by Spec 14:
 *   - lightweight model instead of the coaching-chat model
 *   - a persisted per-run message cap (decision 5) instead of unlimited
 *     ephemeral turns; a run reaching the cap can still be submitted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimit = checkRateLimit({ key: `practice-chat:${user.id}`, limit: 45, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many chat requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Ownership check ─────────────────────────────────────────────
  const { data: portfolio } = await supabaseServer
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: run } = await supabaseServer
    .from("practice_runs")
    .select("id, assistant_message_count, submitted_at")
    .eq("id", runId)
    .eq("candidate_id", portfolio.id)
    .maybeSingle();

  if (!run) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Cap check (Spec 14 decision 5) ──────────────────────────────
  if (run.assistant_message_count >= PRACTICE_MESSAGE_CAP) {
    return new Response(
      JSON.stringify({
        error: "cap_reached",
        message:
          "You've reached the practice conversation limit for this run. You can still submit your response.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    messages?: { role: "user" | "assistant"; content: string }[];
    taskTitle?: string;
    taskDescription?: string;
    taskGuidance?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, taskTitle, taskDescription = "", taskGuidance = [] } = body;

  if (!messages || messages.length === 0 || !taskTitle) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: messages and taskTitle" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Increment before calling Claude — the turn is "spent" whether or not the
  // model call succeeds, same principle as the assessed flow's credit debit
  // happening before the run, not after.
  await supabaseServer
    .from("practice_runs")
    .update({ assistant_message_count: run.assistant_message_count + 1 })
    .eq("id", runId);

  const systemPrompt = `You are a practice simulation coaching assistant for Evidentize Portfolio Simulations. You help candidates work through a free Practice Trial task. Your role is to guide, not give answers.

The candidate is currently working on a task called: ${taskTitle}

Task description: ${taskDescription}

Task guidance points:
${taskGuidance.join("\n")}

Rules:
- Never write the answer for the candidate
- Ask guiding questions to help them think through the problem
- Reference the task guidance points when relevant
- Keep responses concise (2-3 sentences max)
- Be encouraging but professional
- If they ask you to write their response, politely decline and offer a guiding question instead
- If asked, make clear this is a free practice run and does not produce a score, band, or credential`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: PRACTICE_ASSISTANT_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}

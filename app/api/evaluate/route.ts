import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensurePortfolioProfile } from "@/lib/portfolio/ensureProfile";
import { getActiveRubric } from "@/lib/portfolio/getActiveRubric"; // ← NEW
import type { VerdictBand } from "@/types/database";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });


// ─────────────────────────────────────────────────────────────────
// SYSTEM_PROMPT is now fetched from the `rubrics` table per simulation_slug.
// See lib/portfolio/getActiveRubric.ts
// ─────────────────────────────────────────────────────────────────
// const SYSTEM_PROMPT = `You are a professional assessment evaluator for Career Bridge Portfolio Simulations. ...`;

interface TaskAttachment {
  type: "file" | "url";
  path?: string;
  url?: string;
}

interface TaskInput {
  taskId: number;
  title: string;
  response: string;
  attachments?: TaskAttachment[];
}

type EvaluationWarning = {
  message: string;
  details?: string;
};

// Maps Claude's frontend verdict to the DB VerdictBand enum
function toVerdictBand(verdict: string): VerdictBand {
  if (verdict === "Pass with Merit") return "Merit";
  return verdict as VerdictBand;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimit = checkRateLimit({
    key: `evaluate:${user.id}`,
    limit: 10,
    windowMs: 5 * 60_000,
  });

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many evaluation requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    });
  }

  let body: { responses?: TaskInput[]; session_id?: string; simulation_slug?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { responses, session_id, simulation_slug } = body;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[evaluate] ANTHROPIC_API_KEY is not set");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── CHANGED: simulation_slug is now required (needed to fetch rubric) ───
  // if (!session_id) {
  //   console.warn("[evaluate] session_id missing — evaluation will run but result will not be persisted");
  // }
  if (!simulation_slug) {
    return new Response(
      JSON.stringify({ error: "simulation_slug is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!session_id) {
    console.warn("[evaluate] session_id missing — evaluation will run but result will not be persisted");
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing or empty 'responses' array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── NEW: fetch the active rubric for this simulation ────────────────────
  let rubric;
  try {
    rubric = await getActiveRubric(simulation_slug);
  } catch (err) {
    console.error("[evaluate] rubric fetch failed:", err);
    return new Response(
      JSON.stringify({ error: "No rubric configured for this simulation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Generate signed URLs for any file attachments so Claude can reference them
  const signedUrls = new Map<string, string>();
  for (const t of responses) {
    for (const att of t.attachments ?? []) {
      if (att.type === "file" && att.path) {
        try {
          const { data } = await supabase.storage
            .from("simulation-submissions")
            .createSignedUrl(att.path, 3600);
          if (data?.signedUrl) signedUrls.set(att.path, data.signedUrl);
        } catch {
          // Non-fatal — attachment reference will be omitted from the prompt
        }
      }
    }
  }

  // Build the user message containing each task response + attachment references
  const userMessage = responses
    .map((t) => {
      const attachmentLines = (t.attachments ?? [])
        .map((a) => {
          if (a.type === "url" && a.url) {
            return `  [Candidate submitted URL: ${a.url}]`;
          }
          if (a.type === "file" && a.path) {
            const signed = signedUrls.get(a.path);
            return signed
              ? `  [Candidate uploaded document (accessible for 1 hour): ${signed}]`
              : `  [Candidate uploaded a document — file reference: ${a.path}]`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");

      const body = t.response.trim();
      return attachmentLines
        ? `TASK ${t.taskId} — ${t.title}\n${"─".repeat(40)}\n${body}\n${attachmentLines}`
        : `TASK ${t.taskId} — ${t.title}\n${"─".repeat(40)}\n${body}`;
    })
    .join("\n\n");

  let rawContent: string;

  try {
    const message = await client.messages.create({
      // ─── CHANGED: model + system prompt now come from the DB ───
      // model: "claude-sonnet-4-6",
      // system: SYSTEM_PROMPT,
      model: rubric.model,
      system: rubric.system_prompt,
      // ───────────────────────────────────────────────────────────
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Please evaluate the following simulation responses:\n\n${userMessage}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block) {
      console.error("[evaluate] Empty content array. stop_reason:", message.stop_reason);
      return new Response(
        JSON.stringify({ error: "Claude returned an empty response", stop_reason: message.stop_reason }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (block.type !== "text") {
      return new Response(
        JSON.stringify({ error: "Unexpected response type from Claude API" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    rawContent = block.text;
  } catch (err) {
    console.error("[evaluate] Claude API call failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Claude API call failed", details: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse Claude's JSON response — strip markdown fences Claude sometimes wraps output in
  let evaluation: Record<string, unknown>;
  try {
    const jsonStr = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    evaluation = JSON.parse(jsonStr);
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse evaluation JSON", raw: rawContent }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Persist to Supabase (authenticated requests only) ──────────
  const warnings: EvaluationWarning[] = [];

  if (session_id && simulation_slug) {
    try {
      type EvalTask = {
        taskId: number;
        title: string;
        score: number;
        maxScore: number;
        summary: string;
        criteria: Array<{ name: string; score: 1 | 2 | 3; level: string; feedback: string }>;
      };

      const tasks = (evaluation.tasks as EvalTask[]) ?? [];

      const task_scores = tasks.map((t) => ({
        taskId: t.taskId,
        title: t.title,
        score: t.score,
        maxScore: t.maxScore,
        summary: t.summary,
      }));

      const criteria_scores = tasks.flatMap((t) =>
        t.criteria.map((c) => ({
          taskId: t.taskId,
          name: c.name,
          score: c.score,
          level: c.level,
          feedback: c.feedback,
        }))
      );

      const { error: evaluationWriteError } = await supabase.from("evaluation_results").upsert(
        {
          session_id,
          user_id: user.id,
          simulation_slug,
          // ─── NEW: tag this result with the rubric that produced it ───
          rubric_id: rubric.id,
          rubric_version: rubric.version,
          // ─────────────────────────────────────────────────────────────
          verdict_band: toVerdictBand(evaluation.verdict as string),
          overall_score: (evaluation.overallScore as number) ?? null,
          task_scores,
          criteria_scores,
          feedback_text: (evaluation.verdictDescription as string) ?? null,
          raw_evaluation: evaluation,
        },
        { onConflict: "session_id" }
      );

      if (evaluationWriteError) {
        console.error("[evaluate] evaluation_results upsert failed:", {
          session_id,
          simulation_slug,
          user_id: user.id,
          error: evaluationWriteError.message,
        });
        warnings.push({
          message: "Your evaluation was scored, but the saved result could not be written to the database.",
          details: evaluationWriteError.message,
        });
      }

      const { error: sessionUpdateError } = await supabase
        .from("simulation_sessions")
        .update({ status: "evaluated" })
        .eq("id", session_id)
        .eq("user_id", user.id); // RLS double-check

      if (sessionUpdateError) {
        console.error("[evaluate] simulation_sessions update failed:", {
          session_id,
          simulation_slug,
          user_id: user.id,
          error: sessionUpdateError.message,
        });
        warnings.push({
          message: "Your evaluation was scored, but your session status could not be updated.",
          details: sessionUpdateError.message,
        });
      }
    } catch (dbErr) {
      console.error("[evaluate] Supabase write failed:", dbErr);
      warnings.push({
        message: "Your evaluation was scored, but one or more database writes failed.",
        details: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    // ── Portfolio auto-creation ────────────────────────────────────
    try {
      const displayName =
        (user.user_metadata?.full_name as string | undefined)
        ?? user.email?.split('@')[0]
        ?? 'candidate';
      await ensurePortfolioProfile(user.id, displayName, supabase);
    } catch (portfolioErr) {
      console.error('[evaluate] portfolio auto-create failed', {
        user_id: user.id,
        simulation_slug,
        session_id,
        error: portfolioErr instanceof Error ? portfolioErr.message : String(portfolioErr),
        timestamp: new Date().toISOString(),
      });
      warnings.push({
        message: "Your portfolio profile could not be auto-created.",
        details: portfolioErr instanceof Error ? portfolioErr.message : String(portfolioErr),
      });
    }
  }

  const payload = warnings.length > 0 ? { ...evaluation, warnings } : evaluation;

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
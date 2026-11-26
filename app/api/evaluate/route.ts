import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { createClient as createSupabaseServerClient, supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensurePortfolioProfile } from "@/lib/portfolio/ensureProfile";
import { getActiveRubric } from "@/lib/portfolio/getActiveRubric";
import { getSimulationBySlug } from "@/lib/practice/getPracticeSimulation";
import type { VerdictBand } from "@/types/database";

// Vercel/Next.js function timeout — Claude evaluation calls can take 30–90s
// on long system prompts. Default (60s for Pro, 10s for Hobby) is insufficient.
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });


// ─────────────────────────────────────────────────────────────────
// SYSTEM_PROMPT is now fetched from the `rubrics` table per simulation_slug.
// See lib/portfolio/getActiveRubric.ts
// ─────────────────────────────────────────────────────────────────
// const SYSTEM_PROMPT = `You are a professional assessment evaluator for Evidentize Portfolio Simulations. ...`;

/** Appended to every rubric so feedback matches the candidate's response language. */
const LANGUAGE_MATCHING_INSTRUCTION = `
LANGUAGE (required):
- For each task, detect the primary language of the candidate's written response and substantive attachments. Evaluate content in that language.
- Write all narrative feedback in that same language: per-task summary, each criterion's feedback, verdictDescription, strengths, and development areas. If tasks use different languages, match each task's feedback to that task's language.
- Keep JSON property names unchanged. Keep these fields exactly in English as specified by the rubric: verdict (e.g. "Pass", "Distinction"), and each criterion level ("Weak", "Competent", "Strong"). Criterion names may stay in English if the rubric defines them in English.
`.trim();

function buildEvaluationSystemPrompt(rubricSystemPrompt: string, outputInstructions: string | null): string {
  const parts = [rubricSystemPrompt.trim()];
  if (outputInstructions?.trim()) parts.push(outputInstructions.trim());
  parts.push(LANGUAGE_MATCHING_INSTRUCTION);
  return parts.join("\n\n");
}

interface TaskAttachment {
  type: "file" | "url";
  path?: string;
  url?: string;
  isEvidence?: boolean;
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

// ── Content-block helpers ─────────────────────────────────────────

type NativeBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

function mimeFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "csv": return "text/csv";
    default: return null;
  }
}

async function fetchFileBlock(signedUrl: string, mime: string): Promise<NativeBlock | null> {
  try {
    const res = await fetch(signedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    if (mime === "text/csv") {
      let text = await res.text();
      if (text.length > 3000) text = text.slice(0, 3000) + "…";
      return { type: "text", text: `[CSV file contents]:\n${text}` };
    }
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    if (mime === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    const imageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
    if ((imageTypes as readonly string[]).includes(mime)) {
      return { type: "image", source: { type: "base64", media_type: mime as typeof imageTypes[number], data } };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchUrlBlock(url: string): Promise<NativeBlock | string> {
  // Direct fetch first — handles plain PDFs without going through Jina
  try {
    const directRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (directRes.ok) {
      const contentType = directRes.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        const data = Buffer.from(await directRes.arrayBuffer()).toString("base64");
        return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
      }
    }
  } catch {
    // fall through to Jina
  }

  // Jina Reader — extracts clean readable text from JS-rendered pages
  // (Notion, Google Drive, Medium, etc.) — free tier, no API key needed
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "text/plain" },
    });

    if (jinaRes.ok) {
      let text = await jinaRes.text();
      // Detect auth walls — Jina returns them as text but they contain no real content
      const lower = text.toLowerCase();
      const isAuthWall =
        text.length < 500 ||
        lower.includes("sign in") ||
        lower.includes("log in") ||
        lower.includes("access denied") ||
        lower.includes("this page is private") ||
        lower.includes("you need permission");

      if (isAuthWall) {
        return `[URL: ${url} — page is private or requires login. Share the link publicly so it can be read by the evaluator.]`;
      }

      if (text.length > 4000) text = text.slice(0, 4000) + "…";
      return `[Content from ${url}]:\n${text}`;
    }

    return `[URL: ${url} — could not be accessed (HTTP ${jinaRes.status}). Make sure the link is publicly shared.]`;
  } catch {
    return `[URL: ${url} — could not be fetched. Check the link is correct and publicly accessible.]`;
  }
}

type DbAttachmentRow = {
  task_id: number;
  type: "file" | "url";
  file_path: string | null;
  url: string | null;
  is_evidence: boolean;
};

function attachmentKey(att: TaskAttachment): string | null {
  if (att.type === "file" && att.path) return `file:${att.path}`;
  if (att.type === "url" && att.url) return `url:${att.url}`;
  return null;
}

/** Merge DB rows into client payload; client entries win on duplicate keys. */
function mergeAttachmentsFromDb(
  responses: TaskInput[],
  dbRows: DbAttachmentRow[]
): TaskInput[] {
  return responses.map((task) => {
    const attachments = [...(task.attachments ?? [])];
    const seen = new Set(
      attachments.map(attachmentKey).filter((k): k is string => k !== null)
    );

    for (const row of dbRows.filter((r) => r.task_id === task.taskId)) {
      if (row.type === "file" && row.file_path) {
        const key = `file:${row.file_path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        attachments.push({
          type: "file",
          path: row.file_path,
          isEvidence: row.is_evidence,
        });
      } else if (row.type === "url" && row.url) {
        const key = `url:${row.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        attachments.push({
          type: "url",
          url: row.url,
          isEvidence: row.is_evidence,
        });
      }
    }

    return attachments.length > 0 ? { ...task, attachments } : task;
  });
}

async function loadSessionAttachments(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<DbAttachmentRow[]> {
  const { data: session, error: sessionError } = await supabase
    .from("simulation_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError || !session) {
    console.warn("[evaluate] session not found for attachment load:", {
      session_id: sessionId,
      error: sessionError?.message,
    });
    return [];
  }

  const { data: rows, error } = await supabase
    .from("simulation_session_attachments")
    .select("task_id, type, file_path, url, is_evidence")
    .eq("session_id", sessionId);

  if (error) {
    console.error("[evaluate] simulation_session_attachments load failed:", error.message);
    return [];
  }

  return (rows ?? []) as DbAttachmentRow[];
}

async function appendAttachmentsToContentBlocks(
  supabase: SupabaseClient,
  responses: TaskInput[],
  contentBlocks: NativeBlock[],
  sessionId: string | undefined
): Promise<void> {
  const hasAttachments = responses.some((t) => (t.attachments ?? []).length > 0);
  if (!hasAttachments) {
    console.log("[evaluate] no attachments to send", { session_id: sessionId });
    return;
  }

  contentBlocks.push({
    type: "text",
    text: "---\nThe candidate also submitted the following supporting materials:",
  });

  for (const t of responses) {
    for (const att of t.attachments ?? []) {
      const role = att.isEvidence ? "Supporting evidence" : "Primary submission file";
      const label = `TASK ${t.taskId} (${t.title}) — ${role}:`;

      if (att.type === "file" && att.path) {
        const filename = att.path.split("/").pop() ?? att.path;
        try {
          const { data: signedData, error: signError } = await supabase.storage
            .from("simulation-submissions")
            .createSignedUrl(att.path, 3600);
          const mime = mimeFromPath(att.path);
          const block =
            signedData?.signedUrl && mime
              ? await fetchFileBlock(signedData.signedUrl, mime)
              : null;

          if (block) {
            contentBlocks.push({ type: "text", text: label });
            contentBlocks.push(block);
            console.log("[evaluate] attachment sent to Claude:", {
              session_id: sessionId,
              taskId: t.taskId,
              file: filename,
              mime,
              blockType: block.type,
              isEvidence: !!att.isEvidence,
            });
          } else {
            contentBlocks.push({
              type: "text",
              text: `${label}\n[File uploaded — content could not be read (unsupported format or fetch error)]`,
            });
            console.warn("[evaluate] attachment fetch failed:", {
              session_id: sessionId,
              taskId: t.taskId,
              file: filename,
              mime,
              signError: signError?.message,
              hasSignedUrl: !!signedData?.signedUrl,
              isEvidence: !!att.isEvidence,
            });
          }
        } catch (err) {
          console.warn("[evaluate] attachment error:", {
            session_id: sessionId,
            taskId: t.taskId,
            file: filename,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (att.type === "url" && att.url) {
        const resolved = await fetchUrlBlock(att.url);
        if (typeof resolved === "string") {
          contentBlocks.push({ type: "text", text: `${label}\n${resolved}` });
          console.log("[evaluate] attachment URL (text fallback):", {
            session_id: sessionId,
            taskId: t.taskId,
            url: att.url,
            isEvidence: !!att.isEvidence,
          });
        } else {
          contentBlocks.push({ type: "text", text: label });
          contentBlocks.push(resolved);
          console.log("[evaluate] attachment URL sent to Claude:", {
            session_id: sessionId,
            taskId: t.taskId,
            url: att.url,
            blockType: resolved.type,
            isEvidence: !!att.isEvidence,
          });
        }
      }
    }
  }
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

  // ─── Spec 14 decision 7: explicit rejection at the top of the handler — ───
  // ─── Practice Trials are never evaluated by this endpoint. ────────────────
  const evaluatedSim = await getSimulationBySlug(simulation_slug);
  if (evaluatedSim?.simulation_type === "practice") {
    return new Response(
      JSON.stringify({ error: "practice_simulation" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
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

  // Load attachments from DB so PDFs in simulation_session_attachments are always included
  let responsesForEval = responses;
  if (session_id) {
    const clientAttachmentCount = responses.reduce(
      (n, t) => n + (t.attachments?.length ?? 0),
      0
    );
    const dbAttachments = await loadSessionAttachments(supabase, session_id, user.id);
    responsesForEval = mergeAttachmentsFromDb(responses, dbAttachments);
    const mergedAttachmentCount = responsesForEval.reduce(
      (n, t) => n + (t.attachments?.length ?? 0),
      0
    );
    console.log("[evaluate] attachments merged from session:", {
      session_id,
      fromClient: clientAttachmentCount,
      fromDb: dbAttachments.length,
      mergedTotal: mergedAttachmentCount,
    });
  }

  // Build task text for the intro block
  const taskText = responsesForEval
    .map((t) => `TASK ${t.taskId} — ${t.title}\n${"─".repeat(40)}\n${t.response.trim()}`)
    .join("\n\n");

  // Content blocks — Claude reads each natively (PDF/image) or as extracted text
  const contentBlocks: NativeBlock[] = [
    {
      type: "text",
      text: `Evaluate the following simulation responses. Detect each task's language and write scoring feedback in that language.\n\n${taskText}`,
    },
  ];

  await appendAttachmentsToContentBlocks(
    supabase,
    responsesForEval,
    contentBlocks,
    session_id
  );

  let rawContent: string;

  try {
    const message = await client.messages.create({
      // ─── CHANGED: model + system prompt now come from the DB ───
      // model: "claude-sonnet-4-6",
      // system: SYSTEM_PROMPT,
      model: rubric.model,
      system: buildEvaluationSystemPrompt(rubric.system_prompt, rubric.output_instructions),
      // ───────────────────────────────────────────────────────────
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: contentBlocks,
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

  // Parse Claude's JSON response — robustly extract JSON from any wrapping
  // (markdown fences, prose preamble, hybrid documents, prose with stray braces)
  let evaluation: Record<string, unknown>;
  try {
    const firstBrace = rawContent.indexOf("{");
    if (firstBrace === -1) {
      throw new Error("No JSON object found in Claude response");
    }
    // Try last-brace-first (cheapest, handles the common case). If trailing
    // prose contains a stray '}', fall back to scanning backwards through
    // each candidate '}' position until JSON.parse succeeds.
    let parsed: Record<string, unknown> | null = null;
    let lastBrace = rawContent.lastIndexOf("}");
    while (lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(rawContent.slice(firstBrace, lastBrace + 1));
        break;
      } catch {
        lastBrace = rawContent.lastIndexOf("}", lastBrace - 1);
      }
    }
    if (parsed === null) {
      throw new Error("No parseable JSON object found in Claude response");
    }
    evaluation = parsed;
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

    // ── Mark the activation attempt complete (Spec 15 credit model) ──
    // Lets SimulationCard treat a later click as a genuine retake (charge
    // again) instead of a resume (free) — see hasIncompleteActivation() in
    // lib/access-control.ts. Uses supabaseServer since candidates have no
    // UPDATE policy on simulation_activations (writes to it are otherwise
    // SECURITY DEFINER-only, via the activate_simulation RPC).
    try {
      const { data: portfolioForActivation } = await supabaseServer
        .from("portfolio_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (portfolioForActivation && evaluatedSim?.id) {
        const { error: activationCompleteError } = await supabaseServer
          .from("simulation_activations")
          .update({ completed_at: new Date().toISOString() })
          .eq("candidate_id", portfolioForActivation.id)
          .eq("simulation_id", evaluatedSim.id)
          .is("completed_at", null);

        if (activationCompleteError) {
          console.error("[evaluate] simulation_activations completion update failed:", {
            simulation_slug,
            user_id: user.id,
            error: activationCompleteError.message,
          });
        }
      }
    } catch (activationErr) {
      console.error("[evaluate] simulation_activations completion update threw:", {
        simulation_slug,
        user_id: user.id,
        error: activationErr instanceof Error ? activationErr.message : String(activationErr),
      });
    }
  }

  const payload = warnings.length > 0 ? { ...evaluation, warnings } : evaluation;

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
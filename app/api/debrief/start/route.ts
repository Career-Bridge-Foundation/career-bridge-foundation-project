import { NextRequest } from "next/server";
import { createClient, supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateDebriefQuestions } from "@/lib/debrief/generateQuestions";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimit = checkRateLimit({
    key: `debrief:start:${user.id}`,
    limit: 5,
    windowMs: 60 * 60_000,
  });

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many debrief requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    });
  }

  let body: { session_id?: string; evaluation_id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { session_id, evaluation_id } = body;

  if (!session_id) {
    return new Response(JSON.stringify({ error: "session_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guard: one active debrief per session (discarded ones are ignored)
  const { data: existing } = await supabaseServer
    .from("debriefs")
    .select("id, status")
    .eq("session_id", session_id)
    .eq("user_id", user.id)
    .neq("status", "discarded")
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "Debrief already exists for this session", debrief_id: existing.id }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch evaluation to generate context-aware questions
  const evalQuery = supabaseServer
    .from("evaluation_results")
    .select("id, verdict_band, overall_score, feedback_text, task_scores, simulation_slug")
    .eq("user_id", user.id);

  const { data: evalData, error: evalError } = await (
    evaluation_id
      ? evalQuery.eq("id", evaluation_id).maybeSingle()
      : evalQuery.eq("session_id", session_id).maybeSingle()
  );

  if (evalError || !evalData) {
    return new Response(
      JSON.stringify({ error: "Evaluation not found for this session" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Generate reflective questions with Claude
  let questions;
  try {
    questions = await generateDebriefQuestions({
      simulationSlug: evalData.simulation_slug,
      verdictBand: evalData.verdict_band,
      overallScore: evalData.overall_score,
      feedbackText: evalData.feedback_text,
      taskScores: evalData.task_scores ?? [],
    });
  } catch (err) {
    console.error("[debrief/start] question generation failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate debrief questions" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // INSERT via service role — debriefs has no user INSERT policy by design
  const { data: debrief, error: insertError } = await supabaseServer
    .from("debriefs")
    .insert({
      user_id: user.id,
      session_id,
      evaluation_id: evalData.id,
      status: "pending",
      questions_generated: questions,
    })
    .select()
    .single();

  if (insertError || !debrief) {
    console.error("[debrief/start] insert failed:", insertError?.message);
    return new Response(
      JSON.stringify({ error: "Failed to create debrief record" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(debrief), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

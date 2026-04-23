import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import type { VerdictBand } from "@/types/database";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a professional assessment evaluator for Career Bridge Portfolio Simulations. Your role is to evaluate a candidate's responses across five simulation tasks against the rubric below and produce a structured JSON report.

Scoring scale for each criterion:
- 1 = Weak
- 2 = Competent
- 3 = Strong

---

RUBRIC

Prompt 1 — Market Discovery (3 criteria, max 9 points)

1. Research Method Selection
   Weak (1): Generic methods listed with no rationale or acknowledgement of limitations.
   Competent (2): Two or more appropriate methods cited with brief justification.
   Strong (3): Multi-method approach tailored to startup context with trade-off explanation.

2. Stakeholder and Source Targeting
   Weak (1): Only mentions customers or founders generically.
   Competent (2): Identifies startup growth stages and non-obvious sources such as accelerators or angels.
   Strong (3): Maps specific stakeholder groups to specific types of insight they would yield.

3. Insight Validation and Prioritisation
   Weak (1): No filtering, triangulation, or ranking method described.
   Competent (2): Mentions triangulating across sources or applying a framework.
   Strong (3): Describes a clear validation step such as a prioritisation matrix that distinguishes validated needs from nice-to-haves.

---

Prompt 2 — Competitive Landscape (3 criteria, max 9 points)

1. Competitive Analysis Depth
   Weak (1): Vague descriptions without specifics or structure.
   Competent (2): Identifies specific competitor features mapped to startup needs.
   Strong (3): Structured comparison across multiple dimensions with a credible gap identified and evidenced.

2. Nexus Bank Differentiation Logic
   Weak (1): Claims brand or trust as sole differentiator.
   Competent (2): Identifies one genuine advantage connected to a real startup need.
   Strong (3): Differentiated positioning grounded in Nexus capabilities and competitor gaps, with honest acknowledgement of limitations.

3. Strategic Application
   Weak (1): Analysis is a standalone exercise not connected to product decisions.
   Competent (2): Suggests positioning choices informed by the analysis.
   Strong (3): Explicitly shapes product decisions including what not to build and why.

---

Prompt 3 — Product Strategy Definition (3 criteria, max 9 points)

1. Feature Prioritisation Rationale
   Weak (1): Lists features without justification or framework.
   Competent (2): Two to three features with brief justification for each.
   Strong (3): Prioritises using explicit criteria with deliberate deferrals explained.

2. Constraint Navigation
   Weak (1): Ignores the compliance tension entirely.
   Competent (2): Acknowledges the tension and proposes a plausible approach.
   Strong (3): Proposes a specific mechanism such as risk-tiered onboarding with an internal alignment plan.

3. Success Metrics Definition
   Weak (1): Vague terms such as "good growth" with no targets or timeframes.
   Competent (2): Two or three specific metrics with a timeframe stated.
   Strong (3): Metric stack spanning acquisition, engagement, retention and strategic value, connected to the business case.

---

Prompt 4 — Stakeholder Communication (3 criteria, max 9 points)

1. Audience Awareness
   Weak (1): Generic writing not adapted to executive concerns or language.
   Competent (2): Focuses on business outcomes with appropriate executive language.
   Strong (3): Calibrated to specific executive concerns, anticipating objections from identifiable stakeholders.

2. Clarity of Recommendation
   Weak (1): Recommendation buried or absent, no clear point of view.
   Competent (2): Clear recommendation stated early with supporting reasons.
   Strong (3): Sharp one-sentence recommendation, logical structure, and explicit ask.

3. Strategic Persuasion
   Weak (1): Relies on enthusiasm rather than evidence.
   Competent (2): Supports recommendation with data and connects it to a strategic objective.
   Strong (3): Weaves market evidence, competitive pressure, capability, and commercial upside together with honest risk acknowledgement.

---

Prompt 5 — Strategic Summary (3 criteria, max 9 points)

1. Synthesis Quality
   Weak (1): Repeats earlier points without connecting them into a narrative.
   Competent (2): Pulls findings together into a logical, coherent flow.
   Strong (3): Tightly integrated narrative where each element builds on the last.

2. Strategic Coherence
   Weak (1): Contradicts earlier analysis or relies on unstated assumptions.
   Competent (2): Maintains consistency with clearly stated assumptions.
   Strong (3): Every strategic choice is traceable to a validated insight, with explicit assumptions and pivot triggers named.

3. Executive Readability
   Weak (1): Disorganised, overly long, or unprofessional.
   Competent (2): Well-structured, concise, professional — could be shared with minor edits.
   Strong (3): Publication-ready. A CEO could read it in under five minutes and understand the opportunity, plan, and risks.

---

VERDICT BANDS (total score out of 45):

39–45 (85–100%): Distinction — Exceptional thinking. Credential issued with distinction.
32–38 (70–84%): Pass with Merit — Solid, well-reasoned work. Credential issued.
25–31 (55–69%): Pass — Understands fundamentals. Credential issued.
18–24 (40–54%): Borderline — Gaps in analysis. No credential issued.
0–17 (below 40%): Did Not Pass — Needs significant development. Candidate may retry in 7 days.

---

OUTPUT INSTRUCTIONS

You must return ONLY valid JSON with no markdown fences, no preamble, and no commentary outside the JSON object. The exact structure required is:

{
  "overallScore": <number>,
  "maxScore": 45,
  "percentage": <number, rounded to one decimal place>,
  "verdict": <"Distinction" | "Pass with Merit" | "Pass" | "Borderline" | "Did Not Pass">,
  "verdictDescription": <string, one sentence explaining the verdict>,
  "credentialIssued": <boolean>,
  "tasks": [
    {
      "taskId": <number>,
      "title": <string>,
      "score": <number>,
      "maxScore": 9,
      "criteria": [
        {
          "name": <string>,
          "score": <1 | 2 | 3>,
          "level": <"Weak" | "Competent" | "Strong">,
          "feedback": <string, 1–3 sentences referencing what the candidate actually wrote>
        }
      ],
      "summary": <string, 2–3 sentences summarising this task's performance>
    }
  ]
}

Evaluate only the tasks present in the input. If fewer than five tasks are provided, include only those tasks in the output and adjust overallScore, maxScore, and percentage accordingly (maxScore = number of tasks × 9).`;

interface TaskInput {
  taskId: number;
  title: string;
  response: string;
}

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

  if (!session_id) {
    console.warn("[evaluate] session_id missing — evaluation will run but result will not be persisted");
  }

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing or empty 'responses' array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build the user message containing each task response
  const userMessage = responses
    .map(
      (t) =>
        `TASK ${t.taskId} — ${t.title}\n${"─".repeat(40)}\n${t.response.trim()}`
    )
    .join("\n\n");

  let rawContent: string;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please evaluate the following simulation responses:\n\n${userMessage}`,
        },
      ],
    });

    const block = message.content[0];
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

      await supabase.from("evaluation_results").upsert(
        {
          session_id,
          user_id: user.id,
          simulation_slug,
          verdict_band: toVerdictBand(evaluation.verdict as string),
          overall_score: (evaluation.overallScore as number) ?? null,
          task_scores,
          criteria_scores,
          feedback_text: (evaluation.verdictDescription as string) ?? null,
          raw_evaluation: evaluation,
        },
        { onConflict: "session_id" }
      );

      await supabase
        .from("simulation_sessions")
        .update({ status: "evaluated" })
        .eq("id", session_id)
        .eq("user_id", user.id); // RLS double-check
    } catch (dbErr) {
      // Log but don't fail the response — client still gets the evaluation
      console.error("[evaluate] Supabase write failed:", dbErr);
    }
  }

  return new Response(JSON.stringify(evaluation), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

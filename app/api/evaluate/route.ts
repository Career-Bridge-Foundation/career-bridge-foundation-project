/**
 * @swagger
 * /api/evaluate:
 *   post:
 *     summary: Queue or run evaluation for a completed attempt
 *     description: Queues evaluation by default to avoid request timeouts. Internal workers can set run_inline=true to execute immediately.
 *     tags:
 *       - Evaluation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EvaluateRequest'
 *     responses:
 *       200:
 *         description: Evaluation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvaluateSuccessResponse'
 *       202:
 *         description: Evaluation queued (default mode) or queued for manual review follow-up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing attempt id or simulation context
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Attempt or simulation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 300;

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_TIMEOUT_MS = 30000;
const MAX_TOKENS = 1000;
const TEMPERATURE = 0;

const EVALUATION_SYSTEM_PROMPT =
  "You are an expert product management evaluator. You will assess a candidate's written response against a rubric with exactly three criteria. For each criterion, assign a score of 1 (Weak), 2 (Competent), or 3 (Strong) based on the descriptors provided. Return ONLY a valid JSON object. Do not include any text outside the JSON. Do not use markdown code fences.";

const FEEDBACK_TONE_INSTRUCTION =
  "Write all feedback as a senior PM mentor speaking directly to a junior colleague after reviewing their work. Be honest, specific, and constructive. The tone should feel like a career-accelerating conversation, not a school report. Address the candidate as you throughout.";

type ScoreLabel = "Weak" | "Competent" | "Strong";

type PromptCriterion = {
  criterion_name: string;
  score: 1 | 2 | 3;
  score_label: ScoreLabel;
  feedback: string;
};

type PromptEvaluationResult = {
  prompt_number: number;
  criteria: PromptCriterion[];
  prompt_score: number;
  prompt_max: number;
  prompt_percentage: number;
  prompt_verdict: string;
};

type OverallSimulationResult = {
  candidate_name: string;
  candidate_email: string;
  simulation_title: string;
  discipline: string;
  completed_date: string;
  prompt_results: PromptEvaluationResult[];
  overall_score: number;
  overall_max: number;
  overall_percentage: number;
  verdict: string;
  verdict_description: string;
  overall_summary: string;
  top_strength: string;
  top_development_area: string;
  shareable_url_token: string;
  results_video_file: string;
  certifier_trigger: boolean;
  certifier_credential_id: string;
};

type DynamicObject = Record<string, unknown>;

function coerceRecord(value: unknown): DynamicObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as DynamicObject;
}

function criterionNameForIndex(index: number): string {
  return `Criterion ${index + 1}`;
}

function buildRubricText(rubricRaw: unknown): string {
  const rubric = coerceRecord(rubricRaw);

  const criteriaArray = Array.isArray(rubricRaw)
    ? rubricRaw
    : Array.isArray(rubric.criteria)
      ? rubric.criteria
      : [];

  if (criteriaArray.length === 0 && typeof rubricRaw === "string") {
    return rubricRaw;
  }

  if (criteriaArray.length === 0) {
    return [
      "Criterion 1 — Relevance and Strategic Thinking",
      "Weak: Response is generic and does not connect to the prompt",
      "Competent: Response addresses the prompt and includes some useful reasoning",
      "Strong: Response is specific, strategic, and clearly reasoned against the scenario",
      "",
      "Criterion 2 — Practical Product Judgment",
      "Weak: Recommendations are vague or impractical",
      "Competent: Recommendations are somewhat practical with basic tradeoff awareness",
      "Strong: Recommendations are practical, prioritized, and show strong tradeoff handling",
      "",
      "Criterion 3 — Communication and Structure",
      "Weak: Hard to follow and unsupported claims",
      "Competent: Clear enough with some supporting detail",
      "Strong: Clear, concise, and supported with concrete evidence",
    ].join("\n");
  }

  const lines: string[] = [];

  for (let i = 0; i < 3; i += 1) {
    const criterion = coerceRecord(criteriaArray[i]);
    const name =
      (criterion.name as string) ||
      (criterion.criterion_name as string) ||
      criterionNameForIndex(i);

    const weak =
      (criterion.weak as string) ||
      (criterion.score_1 as string) ||
      "Insufficient evidence for this criterion.";
    const competent =
      (criterion.competent as string) ||
      (criterion.score_2 as string) ||
      "Meets baseline expectations with partial evidence.";
    const strong =
      (criterion.strong as string) ||
      (criterion.score_3 as string) ||
      "Demonstrates strong and specific evidence for this criterion.";

    lines.push(`Criterion ${i + 1} — ${name}`);
    lines.push(`Weak: ${weak}`);
    lines.push(`Competent: ${competent}`);
    lines.push(`Strong: ${strong}`);
    if (i < 2) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

function getSimulationPromptText(simulation: DynamicObject, promptNumber: number): string {
  const prompts = Array.isArray(simulation.prompts) ? simulation.prompts : [];
  const promptsEntry = prompts.find((entry) => {
    const row = coerceRecord(entry);
    return Number(row.prompt_number) === promptNumber;
  });

  if (promptsEntry) {
    const promptsRow = coerceRecord(promptsEntry);
    return (
      (promptsRow.prompt_text as string) ||
      (promptsRow.text as string) ||
      (promptsRow.prompt as string) ||
      ""
    );
  }

  const keyCandidates = [
    `prompt_${promptNumber}`,
    `prompt_${promptNumber}_text`,
    `prompt${promptNumber}`,
    `prompt${promptNumber}_text`,
  ];

  for (const key of keyCandidates) {
    const value = simulation[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function getSimulationRubricText(simulation: DynamicObject, promptNumber: number): string {
  const prompts = Array.isArray(simulation.prompts) ? simulation.prompts : [];
  const promptsEntry = prompts.find((entry) => {
    const row = coerceRecord(entry);
    return Number(row.prompt_number) === promptNumber;
  });

  if (promptsEntry) {
    const promptsRow = coerceRecord(promptsEntry);
    if (promptsRow.rubric !== undefined) {
      return buildRubricText(promptsRow.rubric);
    }
  }

  const keyCandidates = [
    `prompt_${promptNumber}_rubric`,
    `prompt${promptNumber}_rubric`,
    `rubric_prompt_${promptNumber}`,
  ];

  for (const key of keyCandidates) {
    if (simulation[key] !== undefined) {
      return buildRubricText(simulation[key]);
    }
  }

  const allRubrics = simulation.rubrics;
  if (allRubrics !== undefined) {
    const rubricsRecord = coerceRecord(allRubrics);
    const promptRubric =
      rubricsRecord[`prompt_${promptNumber}`] ||
      rubricsRecord[`prompt${promptNumber}`] ||
      rubricsRecord[String(promptNumber)];
    if (promptRubric !== undefined) {
      return buildRubricText(promptRubric);
    }
  }

  return buildRubricText(undefined);
}

function getCandidateResponseText(responseRow: DynamicObject): string {
  const submissionType = (responseRow.type as string) || "";

  if (submissionType === "typed") {
    return ((responseRow.text as string) || "").trim();
  }

  if (submissionType === "file") {
    return ((responseRow.extracted_text as string) || "").trim();
  }

  if (submissionType === "url") {
    const rationale = ((responseRow.rationale as string) || "").trim();
    const fetchSuccess = responseRow.fetch_success === true;
    const fetchedContent = ((responseRow.fetched_content as string) || "").trim();

    if (fetchSuccess && fetchedContent) {
      return [
        `Candidate rationale:\n${rationale}`,
        `Fetched URL content:\n${fetchedContent}`,
      ].join("\n\n");
    }

    return rationale;
  }

  return "";
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const firstCurly = text.indexOf("{");
    const lastCurly = text.lastIndexOf("}");

    if (firstCurly === -1 || lastCurly === -1 || lastCurly <= firstCurly) {
      throw new Error("Claude response did not contain a JSON object");
    }

    const jsonSlice = text.slice(firstCurly, lastCurly + 1);
    return JSON.parse(jsonSlice);
  }
}

function isPromptCriterion(value: unknown): value is PromptCriterion {
  const row = coerceRecord(value);
  const validScore = row.score === 1 || row.score === 2 || row.score === 3;
  const validScoreLabel =
    row.score_label === "Weak" ||
    row.score_label === "Competent" ||
    row.score_label === "Strong";

  return (
    typeof row.criterion_name === "string" &&
    validScore &&
    validScoreLabel &&
    typeof row.feedback === "string"
  );
}

function isValidPromptEvaluation(
  value: unknown,
  expectedPromptNumber: number
): value is PromptEvaluationResult {
  const row = coerceRecord(value);

  if (row.prompt_number !== expectedPromptNumber) {
    return false;
  }

  if (!Array.isArray(row.criteria) || row.criteria.length !== 3) {
    return false;
  }

  if (!row.criteria.every((criterion) => isPromptCriterion(criterion))) {
    return false;
  }

  return (
    typeof row.prompt_score === "number" &&
    typeof row.prompt_max === "number" &&
    typeof row.prompt_percentage === "number" &&
    typeof row.prompt_verdict === "string"
  );
}

async function callClaudeEvaluation(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        system: EVALUATION_SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API call failed: ${response.status} ${errorBody}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const outputText = payload.content
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n")
      .trim();

    if (!outputText) {
      throw new Error("Claude response had no text payload");
    }

    return outputText;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function evaluatePromptWithRetry(
  promptNumber: number,
  userMessage: string
): Promise<PromptEvaluationResult> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const rawText = await callClaudeEvaluation(userMessage);

    try {
      const parsed = extractJsonObject(rawText);
      if (!isValidPromptEvaluation(parsed, promptNumber)) {
        throw new Error("JSON shape validation failed");
      }
      return parsed;
    } catch (validationError) {
      if (attempt === 2) {
        throw new Error(
          `Claude returned invalid JSON for prompt ${promptNumber} after retry: ${String(validationError)}`
        );
      }
    }
  }

  throw new Error(`Unexpected evaluation flow failure for prompt ${promptNumber}`);
}

function getVerdictFromPercentage(percentage: number): {
  verdict: string;
  verdict_description: string;
  results_video_file: string;
} {
  if (percentage >= 85) {
    return {
      verdict: "Pass with Distinction",
      verdict_description:
        "Excellent strategic execution. You demonstrated consistently strong product judgment and communication across all prompts. Credential issued.",
      results_video_file: "results-distinction.mp4",
    };
  }

  if (percentage >= 70) {
    return {
      verdict: "Pass with Merit",
      verdict_description:
        "Solid, well-reasoned work. You show genuine product instinct and can handle real complexity. Credential issued.",
      results_video_file: "results-merit.mp4",
    };
  }

  if (percentage >= 55) {
    return {
      verdict: "Pass",
      verdict_description:
        "You met the baseline standard with clear strengths and a focused growth area. Credential issued.",
      results_video_file: "results-pass.mp4",
    };
  }

  return {
    verdict: "Not Yet Competent",
    verdict_description:
      "Your current responses show potential, but you need stronger evidence of product judgment and execution before interviews.",
    results_video_file: "results-not-yet-competent.mp4",
  };
}

function buildOverallSummary(
  promptResults: PromptEvaluationResult[],
  verdict: string,
  topStrength: string,
  topDevelopmentArea: string
): string {
  const strengthsCount = promptResults.filter((p) => p.prompt_score >= 7).length;
  const avg = Math.round(
    promptResults.reduce((sum, p) => sum + p.prompt_percentage, 0) / promptResults.length
  );

  return [
    `Across the simulation, you produced ${strengthsCount} strong prompt-level performances and averaged ${avg}% overall.`,
    `Your strongest pattern was ${topStrength.toLowerCase()}.`,
    `The single most important area to focus next is ${topDevelopmentArea.toLowerCase()}.`,
    `Overall verdict: ${verdict}.`,
  ].join(" ");
}

function findTopStrength(promptResults: PromptEvaluationResult[]): string {
  const allCriteria = promptResults.flatMap((p) => p.criteria);
  if (allCriteria.length === 0) {
    return "Clear communication under constraints";
  }

  const top = [...allCriteria].sort((a, b) => b.score - a.score)[0];
  return top.criterion_name;
}

function findTopDevelopmentArea(promptResults: PromptEvaluationResult[]): string {
  const allCriteria = promptResults.flatMap((p) => p.criteria);
  if (allCriteria.length === 0) {
    return "Structured prioritisation and evidence-backed decision making";
  }

  const weakest = [...allCriteria].sort((a, b) => a.score - b.score)[0];
  return weakest.criterion_name;
}

function buildEvaluationUserMessage(params: {
  scenarioContext: string;
  promptText: string;
  rubricText: string;
  candidateResponse: string;
}): string {
  return [
    "SCENARIO CONTEXT:",
    params.scenarioContext,
    "",
    "CANDIDATE ROLE: Associate Product Manager",
    "",
    "PROMPT BEING EVALUATED:",
    params.promptText,
    "",
    "EVALUATION RUBRIC:",
    "",
    params.rubricText,
    "",
    "IMPORTANT EVALUATION INSTRUCTIONS:",
    "- Evaluate only against the rubric provided",
    "- Be specific about what the candidate actually wrote, not what they could have written",
    "- Do not reward length over quality",
    "- A short precise response that hits all criteria scores higher than a long generic one that hits none",
    "- Reference specific content from their response in feedback fields",
    "- Never use generic phrases like great job or unfortunately",
    "- Feedback length per criterion: 40 to 80 words",
    "",
    "CANDIDATE RESPONSE:",
    params.candidateResponse,
    "",
    FEEDBACK_TONE_INSTRUCTION,
  ].join("\n");
}

function buildGracefulMessage() {
  return "Your response has been saved. We are processing your results and will notify you by email within 24 hours.";
}

export async function POST(request: NextRequest) {
  let attemptIdForLogs = "unknown";

  try {
    const body = (await request.json()) as { attempt_id?: string; run_inline?: boolean };
    const attemptId = (body.attempt_id || "").trim();
    const runInline = body.run_inline === true;
    attemptIdForLogs = attemptId || "missing";

    if (!attemptId) {
      return NextResponse.json({ error: "attempt_id is required" }, { status: 400 });
    }

    if (!runInline) {
      const now = new Date().toISOString();

      const { error: queueError } = await supabaseAdmin.from("evaluation_jobs").upsert(
        {
          attempt_id: attemptId,
          status: "queued",
          queued_at: now,
          started_at: null,
          completed_at: null,
          error_message: null,
        },
        { onConflict: "attempt_id" }
      );

      if (queueError) {
        console.error("Failed to queue evaluation:", queueError);
        return NextResponse.json({ error: "Failed to queue evaluation" }, { status: 500 });
      }

      await supabaseAdmin
        .from("attempts")
        .update({ evaluation_status: "queued" })
        .eq("id", attemptId);

      return NextResponse.json(
        {
          success: true,
          attempt_id: attemptId,
          evaluation_status: "queued",
          message: "Evaluation queued. Poll attempt.evaluation_status for updates.",
        },
        { status: 202 }
      );
    }

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("attempts")
      .select("id, simulation_id, candidate_name, candidate_email, responses")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const { data: simulation, error: simulationError } = await supabaseAdmin
      .from("simulations")
      .select("*")
      .eq("id", attempt.simulation_id)
      .single();

    if (simulationError || !simulation) {
      return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
    }

    const simulationRow = coerceRecord(simulation);
    const scenarioContext =
      (simulationRow.scenario_brief as string) ||
      (simulationRow.scenario_context as string) ||
      (simulationRow.brief as string) ||
      "";

    if (!scenarioContext.trim()) {
      return NextResponse.json(
        { error: "Simulation scenario context is missing" },
        { status: 400 }
      );
    }

    let responses = coerceRecord(attempt.responses);
    const promptResults: PromptEvaluationResult[] = [];

    for (let promptNumber = 1; promptNumber <= 3; promptNumber += 1) {
      const promptKey = `prompt_${promptNumber}`;
      const promptResponse = coerceRecord(responses[promptKey]);
      const candidateResponseText = getCandidateResponseText(promptResponse);
      const promptText = getSimulationPromptText(simulationRow, promptNumber);
      const rubricText = getSimulationRubricText(simulationRow, promptNumber);

      if (!promptText.trim() || !candidateResponseText.trim()) {
        const missingError = new Error(
          `Missing prompt text or candidate response for prompt ${promptNumber}`
        );

        const failureResponses = {
          ...responses,
          evaluation_status: "manual_review_required",
          evaluation_error: {
            prompt_number: promptNumber,
            reason: missingError.message,
            created_at: new Date().toISOString(),
          },
        };

        await supabaseAdmin
          .from("attempts")
          .update({ responses: failureResponses, evaluation_status: "manual_review_required" })
          .eq("id", attemptId);

        console.error("Evaluation data missing", {
          attempt_id: attemptId,
          prompt_number: promptNumber,
          error: missingError,
        });

        return NextResponse.json(
          {
            success: false,
            message: buildGracefulMessage(),
          },
          { status: 202 }
        );
      }

      const userMessage = buildEvaluationUserMessage({
        scenarioContext,
        promptText,
        rubricText,
        candidateResponse: candidateResponseText,
      });

      try {
        const evaluation = await evaluatePromptWithRetry(promptNumber, userMessage);

        promptResults.push(evaluation);

        responses = {
          ...responses,
          [promptKey]: {
            ...promptResponse,
            evaluation,
          },
        };

        const { error: promptSaveError } = await supabaseAdmin
          .from("attempts")
          .update({ responses })
          .eq("id", attemptId);

        if (promptSaveError) {
          throw new Error(`Failed saving prompt ${promptNumber} evaluation: ${promptSaveError.message}`);
        }
      } catch (error) {
        const failureResponses = {
          ...responses,
          evaluation_status: "manual_review_required",
          evaluation_error: {
            prompt_number: promptNumber,
            reason: String(error),
            created_at: new Date().toISOString(),
          },
        };

        await supabaseAdmin
          .from("attempts")
          .update({ responses: failureResponses, evaluation_status: "manual_review_required" })
          .eq("id", attemptId);

        console.error("Evaluation failed", {
          attempt_id: attemptId,
          prompt_number: promptNumber,
          error,
        });

        return NextResponse.json(
          {
            success: false,
            message: buildGracefulMessage(),
          },
          { status: 202 }
        );
      }
    }

    const overallScore = promptResults.reduce((sum, row) => sum + row.prompt_score, 0);
    const overallMax = 27;
    const overallPercentage = Math.round((overallScore / overallMax) * 100);

    const verdictData = getVerdictFromPercentage(overallPercentage);
    const topStrength = findTopStrength(promptResults);
    const topDevelopmentArea = findTopDevelopmentArea(promptResults);

    const overallResult: OverallSimulationResult = {
      candidate_name: attempt.candidate_name || "",
      candidate_email: attempt.candidate_email || "",
      simulation_title:
        (simulationRow.title as string) ||
        "Nexus Bank Startup Account: Product Strategy Simulation",
      discipline: (simulationRow.discipline as string) || "Product Management",
      completed_date: new Date().toISOString(),
      prompt_results: promptResults,
      overall_score: overallScore,
      overall_max: overallMax,
      overall_percentage: overallPercentage,
      verdict: verdictData.verdict,
      verdict_description: verdictData.verdict_description,
      overall_summary: buildOverallSummary(
        promptResults,
        verdictData.verdict,
        topStrength,
        topDevelopmentArea
      ),
      top_strength: topStrength,
      top_development_area: topDevelopmentArea,
      shareable_url_token: crypto.randomUUID().replace(/-/g, ""),
      results_video_file: verdictData.results_video_file,
      certifier_trigger: overallPercentage >= 55,
      certifier_credential_id: "",
    };

    const finalResponses = {
      ...responses,
      evaluation_status: "complete",
      overall_result: overallResult,
    };

    const { error: finalSaveError } = await supabaseAdmin
      .from("attempts")
      .update({ responses: finalResponses, evaluation_status: "complete" })
      .eq("id", attemptId);

    if (finalSaveError) {
      console.error("Final evaluation save failed", {
        attempt_id: attemptId,
        error: finalSaveError,
      });

      return NextResponse.json(
        {
          success: false,
          message: buildGracefulMessage(),
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      success: true,
      attempt_id: attemptId,
      result: overallResult,
    });
  } catch (error) {
    console.error("Evaluate endpoint error", {
      attempt_id: attemptIdForLogs,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        message: buildGracefulMessage(),
      },
      { status: 202 }
    );
  }
}

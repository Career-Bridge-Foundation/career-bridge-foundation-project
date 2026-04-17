import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type DynamicObject = Record<string, unknown>;

/**
 * @swagger
 * /api/attempts/{id}/submit:
 *   post:
 *     summary: Submit simulation attempt
 *     description: Validates all prompt responses are present, marks attempt as submitted, and queues asynchronous evaluation.
 *     tags:
 *       - Attempts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Attempt submitted and evaluation queued
 *       400:
 *         description: Missing required prompt responses
 *       404:
 *         description: Attempt not found
 *       500:
 *         description: Server error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("attempts")
      .select("id, simulation_id, responses, status")
      .eq("id", id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const responses = asRecord(attempt.responses);

    const { data: simulation, error: simulationError } = await supabaseAdmin
      .from("simulations")
      .select("id, prompts")
      .eq("id", attempt.simulation_id)
      .single();

    if (simulationError || !simulation) {
      return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
    }

    const prompts = Array.isArray(simulation.prompts) ? simulation.prompts : [];
    const missingPromptIndexes: number[] = [];

    for (let i = 0; i < prompts.length; i += 1) {
      const prompt = asRecord(prompts[i]);
      const promptIndex = Number(prompt.prompt_number) || i + 1;
      const response = asRecord(responses[`prompt_${promptIndex}`]);

      if (!hasPromptSubmission(response)) {
        missingPromptIndexes.push(promptIndex);
      }
    }

    if (missingPromptIndexes.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot submit simulation until all prompts are completed",
          missing_prompt_indexes: missingPromptIndexes,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateAttemptError } = await supabaseAdmin
      .from("attempts")
      .update({
        status: "submitted",
        submitted_at: now,
        evaluation_status: "queued",
      })
      .eq("id", id);

    if (updateAttemptError) {
      console.error("Failed to mark attempt submitted:", updateAttemptError);
      return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 });
    }

    const { error: queueError } = await supabaseAdmin.from("evaluation_jobs").upsert(
      {
        attempt_id: id,
        status: "queued",
        queued_at: now,
        started_at: null,
        completed_at: null,
        error_message: null,
      },
      { onConflict: "attempt_id" }
    );

    if (queueError) {
      console.error("Failed to queue evaluation job:", queueError);
      return NextResponse.json({ error: "Failed to queue evaluation" }, { status: 500 });
    }

    // Trigger queue processing after response so submit returns immediately.
    after(async () => {
      try {
        await fetch(`${request.nextUrl.origin}/api/evaluate/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attempt_id: id }),
        });
      } catch (error) {
        console.error("Failed to trigger async evaluation processor", { attempt_id: id, error });
      }
    });

    return NextResponse.json(
      {
        success: true,
        attempt_id: id,
        evaluation_status: "queued",
        message: "Simulation submitted. Evaluation has been queued.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Attempt submit error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function asRecord(value: unknown): DynamicObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as DynamicObject;
}

function hasPromptSubmission(response: DynamicObject): boolean {
  const submissionType = String(response.type || "").toLowerCase();

  if (submissionType === "typed") {
    return typeof response.text === "string" && response.text.trim().length > 0;
  }

  if (submissionType === "file") {
    const hasExtractedText = typeof response.extracted_text === "string" && response.extracted_text.trim().length > 0;
    const hasFileMeta = typeof response.file_name === "string" && response.file_name.trim().length > 0;
    return hasExtractedText || hasFileMeta;
  }

  if (submissionType === "url") {
    const hasUrl = typeof response.url === "string" && response.url.trim().length > 0;
    const hasRationale = typeof response.rationale === "string" && response.rationale.trim().length > 0;
    return hasUrl && hasRationale;
  }

  // Fallback for legacy or partial payloads: require at least one non-empty string field.
  return Object.values(response).some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

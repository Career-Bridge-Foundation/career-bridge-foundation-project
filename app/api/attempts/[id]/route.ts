import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type DynamicObject = Record<string, unknown>;

type AttemptPatchBody = {
  current_step?: number;
  last_saved_at?: string;
  drafts?: Record<string, string>;
  responses?: Record<string, unknown>;
};

/**
 * @swagger
 * /api/attempts/{id}:
 *   get:
 *     summary: Get attempt draft state
 *     description: Returns a single attempt with responses, current step, and last autosave timestamp for resume flows.
 *     tags:
 *       - Attempts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attempt found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttemptStateResponse'
 *       404:
 *         description: Attempt not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     summary: Autosave attempt draft state
 *     description: Updates draft prompt text, current step, and last saved timestamp without finalizing prompt submissions.
 *     tags:
 *       - Attempts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttemptAutosaveRequest'
 *     responses:
 *       200:
 *         description: Draft autosaved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttemptStateResponse'
 *       400:
 *         description: Invalid autosave payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Attempt not found
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
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("attempts")
      .select(
        "id, simulation_id, candidate_name, candidate_email, responses, status, evaluation_status, current_step, last_saved_at"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, attempt: data });
  } catch (error) {
    console.error("Attempt GET error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AttemptPatchBody;

    const currentStep = body.current_step;
    if (currentStep !== undefined && (!Number.isInteger(currentStep) || currentStep < 1)) {
      return NextResponse.json(
        { error: "current_step must be a positive integer" },
        { status: 400 }
      );
    }

    const { data: existingAttempt, error: fetchError } = await supabaseAdmin
      .from("attempts")
      .select("responses")
      .eq("id", id)
      .single();

    if (fetchError || !existingAttempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const existingResponses = toRecord(existingAttempt.responses);
    const updatedResponses: DynamicObject = { ...existingResponses };

    const drafts = body.drafts;
    if (drafts && typeof drafts === "object") {
      for (const [rawKey, draftText] of Object.entries(drafts)) {
        if (typeof draftText !== "string") {
          continue;
        }

        const promptKey = normalizePromptKey(rawKey);
        if (!promptKey) {
          continue;
        }

        const existingPromptRow = toRecord(updatedResponses[promptKey]);
        updatedResponses[promptKey] = {
          ...existingPromptRow,
          draft_text: draftText,
          draft_updated_at: new Date().toISOString(),
        };
      }
    }

    const responsesPatch = body.responses;
    if (responsesPatch && typeof responsesPatch === "object") {
      for (const [rawKey, value] of Object.entries(responsesPatch)) {
        const promptKey = normalizePromptKey(rawKey) || rawKey;
        updatedResponses[promptKey] = value;
      }
    }

    const normalizedLastSavedAt = normalizeTimestamp(body.last_saved_at) || new Date().toISOString();

    const updatePayload: DynamicObject = {
      responses: updatedResponses,
      last_saved_at: normalizedLastSavedAt,
    };

    if (currentStep !== undefined) {
      updatePayload.current_step = currentStep;
    }

    const { data: updatedAttempt, error: updateError } = await supabaseAdmin
      .from("attempts")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, simulation_id, candidate_name, candidate_email, responses, status, evaluation_status, current_step, last_saved_at"
      )
      .single();

    if (updateError || !updatedAttempt) {
      console.error("Attempt PATCH update error:", updateError);
      return NextResponse.json({ error: "Failed to autosave attempt" }, { status: 500 });
    }

    return NextResponse.json({ success: true, attempt: updatedAttempt });
  } catch (error) {
    console.error("Attempt PATCH error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function toRecord(value: unknown): DynamicObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as DynamicObject;
}

function normalizePromptKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^prompt_\d+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^\d+$/.test(trimmed)) {
    return `prompt_${trimmed}`;
  }

  if (/^prompt\d+$/i.test(trimmed)) {
    const numberPart = trimmed.replace(/\D/g, "");
    return numberPart ? `prompt_${numberPart}` : null;
  }

  return null;
}

function normalizeTimestamp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
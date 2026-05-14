import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 300;

/**
 * @swagger
 * /api/evaluate/process:
 *   post:
 *     summary: Process queued evaluation jobs
 *     description: Internal worker endpoint that processes queued evaluation jobs by calling /api/evaluate in inline mode.
 *     tags:
 *       - Evaluation
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attempt_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job processing outcome
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvaluateProcessResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/EvaluateProcessResponse'
 *                 - $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { attempt_id?: string };
    const explicitAttemptId = (body.attempt_id || "").trim();

    const jobQuery = supabaseAdmin
      .from("evaluation_jobs")
      .select("id, attempt_id, status")
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(1);

    const { data: queuedJobs, error: queueFetchError } = explicitAttemptId
      ? await jobQuery.eq("attempt_id", explicitAttemptId)
      : await jobQuery;

    if (queueFetchError) {
      console.error("Failed to fetch evaluation jobs:", queueFetchError);
      return NextResponse.json({ error: "Failed to fetch queued jobs" }, { status: 500 });
    }

    const job = queuedJobs?.[0];
    if (!job) {
      return NextResponse.json({ success: true, message: "No queued evaluation job found" });
    }

    const startedAt = new Date().toISOString();
    const { error: startJobError } = await supabaseAdmin
      .from("evaluation_jobs")
      .update({
        status: "processing",
        started_at: startedAt,
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "queued");

    if (startJobError) {
      console.error("Failed to lock evaluation job:", startJobError);
      return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
    }

    await supabaseAdmin
      .from("attempts")
      .update({ evaluation_status: "processing" })
      .eq("id", job.attempt_id);

    const evaluateResponse = await fetch(`${request.nextUrl.origin}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt_id: job.attempt_id, run_inline: true }),
    });

    const responsePayload = (await evaluateResponse.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };

    if (!evaluateResponse.ok || responsePayload.success !== true) {
      const message = responsePayload.message || `Evaluate call failed with status ${evaluateResponse.status}`;

      await supabaseAdmin
        .from("evaluation_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", job.id);

      await supabaseAdmin
        .from("attempts")
        .update({ evaluation_status: "failed" })
        .eq("id", job.attempt_id);

      return NextResponse.json(
        {
          success: false,
          attempt_id: job.attempt_id,
          message,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("evaluation_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id);

    await supabaseAdmin
      .from("attempts")
      .update({ evaluation_status: "complete" })
      .eq("id", job.attempt_id);

    return NextResponse.json({
      success: true,
      attempt_id: job.attempt_id,
      message: "Evaluation job processed successfully",
    });
  } catch (error) {
    console.error("Evaluate process error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

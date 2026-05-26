import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateDebriefSummary } from "@/lib/debrief/generateSummary";
import type { DebriefQuestion } from "@/types/database";

type VapiCall = {
  id: string;
  metadata?: Record<string, string | undefined>;
};

type VapiArtifact = {
  transcript?: string;
  messages?: Array<{ role: string; content: string }>;
};

type VapiMessage = {
  type: string;
  call: VapiCall;
  artifact?: VapiArtifact;
  transcript?: string;
};

type VapiWebhookBody = {
  message: VapiMessage;
};

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: VapiWebhookBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const msg = body?.message;
  if (!msg?.type || !msg?.call?.id) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const vapiCallId = msg.call.id;
  const debriefId = msg.call.metadata?.debriefId;

  // ── call-start: store vapi_call_id and mark in_progress ──────
  if (msg.type === "call-start") {
    if (!debriefId) {
      console.warn("[vapi-webhook] call-start missing debriefId in metadata", { vapiCallId });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabaseServer
      .from("debriefs")
      .update({ status: "in_progress", vapi_call_id: vapiCallId })
      .eq("id", debriefId)
      .eq("status", "pending");

    if (error) {
      console.error("[vapi-webhook] call-start update failed:", {
        debriefId,
        vapiCallId,
        error: error.message,
      });
    } else {
      console.log("[vapi-webhook] call started:", { debriefId, vapiCallId });
    }
  }

  // ── end-of-call-report: store transcript, generate summary ───
  if (msg.type === "end-of-call-report") {
    const transcript = msg.artifact?.transcript ?? msg.transcript ?? null;

    if (!transcript) {
      console.warn("[vapi-webhook] end-of-call-report has no transcript", { vapiCallId, debriefId });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find debrief — prefer metadata debriefId, fall back to vapi_call_id
    type DebriefLookup = { id: string; questions_generated: DebriefQuestion[] | null };
    let debriefRecord: DebriefLookup | null = null;

    if (debriefId) {
      const { data } = await supabaseServer
        .from("debriefs")
        .select("id, questions_generated")
        .eq("id", debriefId)
        .maybeSingle();
      debriefRecord = data as DebriefLookup | null;
    }

    if (!debriefRecord) {
      const { data } = await supabaseServer
        .from("debriefs")
        .select("id, questions_generated")
        .eq("vapi_call_id", vapiCallId)
        .maybeSingle();
      debriefRecord = data as DebriefLookup | null;
    }

    if (!debriefRecord) {
      console.error("[vapi-webhook] debrief not found for end-of-call-report", {
        vapiCallId,
        debriefId,
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Try Claude summary — don't block if it fails; transcript is still stored
    let structuredSummary = null;
    try {
      structuredSummary = await generateDebriefSummary(
        transcript,
        debriefRecord.questions_generated ?? []
      );
    } catch (err) {
      console.error("[vapi-webhook] summary generation failed:", {
        debrief_id: debriefRecord.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const { error: updateError } = await supabaseServer
      .from("debriefs")
      .update({
        status: "pending_review",
        raw_transcript: transcript,
        structured_summary: structuredSummary,
        vapi_call_id: vapiCallId,
      })
      .eq("id", debriefRecord.id);

    if (updateError) {
      console.error("[vapi-webhook] end-of-call-report update failed:", {
        debrief_id: debriefRecord.id,
        error: updateError.message,
      });
    } else {
      console.log("[vapi-webhook] debrief ready for review:", {
        debrief_id: debriefRecord.id,
        has_summary: structuredSummary !== null,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

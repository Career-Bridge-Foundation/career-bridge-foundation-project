import { NextRequest } from "next/server";
import { createClient, supabaseServer } from "@/lib/supabase/server";
import { generateDebriefSummary } from "@/lib/debrief/generateSummary";
import type { DebriefQuestion } from "@/types/database";

export const maxDuration = 60;

const VAPI_BASE = "https://api.vapi.ai";

async function fetchTranscript(callId: string): Promise<string | null> {
  const maxAttempts = 15;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${VAPI_BASE}/call/${callId}`, {
        headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
      });

      if (res.ok) {
        const data = await res.json() as {
          artifact?: { transcript?: string };
          transcript?: string;
        };
        const transcript = data?.artifact?.transcript ?? data?.transcript ?? null;
        if (transcript) return transcript;
      }
    } catch (err) {
      console.warn(`[debrief/process] VAPI fetch attempt ${i + 1} failed:`, err);
    }

    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  let body: { vapi_call_id?: string } = {};
  try {
    body = await request.json();
  } catch { /* body is optional */ }

  const { data: debrief } = await supabase
    .from("debriefs")
    .select("id, status, vapi_call_id, questions_generated")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!debrief) {
    return new Response(JSON.stringify({ error: "Debrief not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Already processed — return the current record immediately
  if (debrief.status === "pending_review" || debrief.status === "approved") {
    const { data: current } = await supabase
      .from("debriefs")
      .select("*")
      .eq("id", id)
      .single();
    return new Response(JSON.stringify(current), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callId = body.vapi_call_id ?? (debrief.vapi_call_id as string | null);
  if (!callId) {
    return new Response(
      JSON.stringify({ error: "No vapi_call_id — call may not have started properly" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // Persist the call ID if not already stored
  if (!debrief.vapi_call_id) {
    await supabaseServer
      .from("debriefs")
      .update({ vapi_call_id: callId, status: "in_progress" })
      .eq("id", id);
  }

  // Fetch transcript from VAPI (retries up to 30 s)
  const transcript = await fetchTranscript(callId);
  if (!transcript) {
    return new Response(
      JSON.stringify({ error: "Transcript not ready. Please wait a moment and try again." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Generate structured summary with Claude
  let structuredSummary = null;
  try {
    structuredSummary = await generateDebriefSummary(
      transcript,
      (debrief.questions_generated as DebriefQuestion[]) ?? []
    );
  } catch (err) {
    console.error("[debrief/process] summary generation failed:", err);
    // Continue — transcript is still stored; candidate sees fallback UI
  }

  const { data: updated, error: updateError } = await supabaseServer
    .from("debriefs")
    .update({
      status: "pending_review",
      raw_transcript: transcript,
      structured_summary: structuredSummary,
      vapi_call_id: callId,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("[debrief/process] update failed:", updateError?.message);
    return new Response(JSON.stringify({ error: "Failed to save debrief" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

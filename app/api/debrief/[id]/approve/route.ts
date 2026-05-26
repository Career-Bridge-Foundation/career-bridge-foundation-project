import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DebriefSummary } from "@/types/database";

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

  const { data: debrief, error: fetchError } = await supabase
    .from("debriefs")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !debrief) {
    return new Response(JSON.stringify({ error: "Debrief not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (debrief.status !== "pending_review") {
    return new Response(
      JSON.stringify({ error: `Cannot approve a debrief with status '${debrief.status}'` }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { candidate_edited_summary?: DebriefSummary } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — empty body means approve without edits
  }

  const update: Record<string, unknown> = {
    status: "approved",
    approved_at: new Date().toISOString(),
  };

  if (body.candidate_edited_summary) {
    update.candidate_edited_summary = body.candidate_edited_summary;
  }

  const { data: updated, error: updateError } = await supabase
    .from("debriefs")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("[debrief/approve] update failed:", { id, error: updateError?.message });
    return new Response(JSON.stringify({ error: "Failed to approve debrief" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

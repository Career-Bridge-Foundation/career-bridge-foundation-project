import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
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

  if (debrief.status === "discarded") {
    return new Response(
      JSON.stringify({ error: "Debrief is already discarded" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  if (debrief.status === "approved") {
    return new Response(
      JSON.stringify({ error: "Cannot discard an approved debrief" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("debriefs")
    .update({ status: "discarded" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    console.error("[debrief/discard] update failed:", { id, error: updateError?.message });
    return new Response(JSON.stringify({ error: "Failed to discard debrief" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

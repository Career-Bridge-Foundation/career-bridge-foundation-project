import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(
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

  const { data, error } = await supabase
    .from("debriefs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[debrief/get] query error:", { id, error: error.message });
    return new Response(JSON.stringify({ error: "Failed to fetch debrief" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Debrief not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(
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

  let body: { is_visible?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof body.is_visible !== "boolean") {
    return new Response(JSON.stringify({ error: "is_visible (boolean) required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify ownership before updating
  const { data: existing } = await supabase
    .from("debriefs")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Debrief not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.status !== "approved") {
    return new Response(JSON.stringify({ error: "Only approved debriefs can be shown/hidden" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabaseServer
    .from("debriefs")
    .update({ is_visible: body.is_visible, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[debrief/patch] update error:", { id, error: error.message });
    return new Response(JSON.stringify({ error: "Failed to update debrief" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

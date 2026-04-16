import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { simulation_id, candidate_name, candidate_email } = body;

    // Validate required fields
    if (!simulation_id || !candidate_name || !candidate_email) {
      return NextResponse.json(
        { error: "simulation_id, candidate_name, and candidate_email are required" },
        { status: 400 }
      );
    }

    // Create the attempt record with empty responses
    const { data, error } = await supabaseAdmin
      .from("attempts")
      .insert({
        simulation_id,
        candidate_name,
        candidate_email,
        responses: {},
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create attempt:", error);
      return NextResponse.json(
        { error: "Failed to start simulation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      attempt_id: data.id,
    });
  } catch (error) {
    console.error("Start attempt error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
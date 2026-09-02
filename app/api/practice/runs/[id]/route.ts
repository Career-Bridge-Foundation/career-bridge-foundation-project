import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/practice/runs/:id
 *
 * Fetches a practice run for the results screen. Ownership is verified via
 * portfolio_profiles.user_id — RLS also scopes practice_runs SELECT to the
 * candidate's own rows, but this route uses the service-role client, so
 * ownership is re-checked explicitly here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: portfolio } = await supabaseServer
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: run, error } = await supabaseServer
    .from("practice_runs")
    .select("id, simulation_id, submitted_at, feedback, created_at")
    .eq("id", id)
    .eq("candidate_id", portfolio.id)
    .maybeSingle();

  if (error || !run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

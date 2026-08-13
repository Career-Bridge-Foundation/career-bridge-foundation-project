import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServerClient, supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { ensurePortfolioProfile } from "@/lib/portfolio/ensureProfile";
import { getSimulationByUuid } from "@/lib/practice/getPracticeSimulation";

export const runtime = "nodejs";

/**
 * POST /api/practice/runs
 *
 * Starts a new Practice Trial run. No entitlement check, no credit, no
 * balance interaction (Spec 14 decision 2) — the only gate is auth.
 *
 * Body: { simulation_id: string (UUID) }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: `practice-runs:${user.id}`,
    limit: 20,
    windowMs: 5 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { simulation_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { simulation_id } = body;
  if (typeof simulation_id !== "string" || !simulation_id) {
    return NextResponse.json({ error: "simulation_id required" }, { status: 400 });
  }

  // ── Explicit rejection at the top of the handler (Spec 14 decision 7) ──
  const sim = await getSimulationByUuid(simulation_id);
  if (!sim) {
    return NextResponse.json({ error: "simulation_not_found" }, { status: 404 });
  }
  if (sim.simulation_type !== "practice") {
    return NextResponse.json({ error: "not_a_practice_simulation" }, { status: 400 });
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "candidate";
  await ensurePortfolioProfile(user.id, displayName, supabaseServer);

  const { data: portfolio, error: portfolioError } = await supabaseServer
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    console.error("[practice/runs] portfolio resolve failed:", portfolioError?.message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  const { data: run, error: insertError } = await supabaseServer
    .from("practice_runs")
    .insert({ candidate_id: portfolio.id, simulation_id: sim.id })
    .select("id")
    .single();

  if (insertError || !run) {
    console.error("[practice/runs] insert failed:", insertError?.message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  return NextResponse.json({ run_id: run.id });
}

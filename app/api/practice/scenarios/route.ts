import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/practice/scenarios
 *
 * Practice Trials available to every candidate, grouped by discipline.
 * No auth/entitlement check — Practice Trials are available to every
 * candidate, always (Spec 14 decision 2).
 */
export async function GET() {
  const { data, error } = await supabaseServer
    .from("simulations")
    .select("id, slug, title, company, industry, discipline, difficulty, time, description")
    .eq("simulation_type", "practice")
    .eq("status", "published")
    .order("discipline", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[practice/scenarios] query failed:", error.message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  const byDiscipline: Record<string, typeof data> = {};
  for (const row of data ?? []) {
    const key = row.discipline ?? "other";
    if (!byDiscipline[key]) byDiscipline[key] = [];
    byDiscipline[key].push(row);
  }

  return NextResponse.json({ scenarios: byDiscipline });
}

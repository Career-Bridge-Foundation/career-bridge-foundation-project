import { supabaseServer } from "@/lib/supabase/server";

/**
 * Service-role lookup used by every app/api/practice/** route (and the
 * practice guard in app/api/evaluate/route.ts) to enforce Spec 14 decision 7:
 * each route must explicitly reject the wrong simulation_type at the top of
 * the handler, not filter it out later.
 */
export type PracticeSimulationLookup = {
  id: string;
  slug: string;
  discipline: string | null;
  simulation_type: string;
};

export async function getSimulationByUuid(
  simulationId: string
): Promise<PracticeSimulationLookup | null> {
  const { data, error } = await supabaseServer
    .from("simulations")
    .select("id, slug, discipline, simulation_type")
    .eq("id", simulationId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getSimulationBySlug(
  slug: string
): Promise<PracticeSimulationLookup | null> {
  const { data, error } = await supabaseServer
    .from("simulations")
    .select("id, slug, discipline, simulation_type")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

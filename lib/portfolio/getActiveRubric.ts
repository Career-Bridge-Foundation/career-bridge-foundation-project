import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses RLS — never import this in client components
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export type ActiveRubric = {
  id: string;
  version: number;
  system_prompt: string;
  model: string;
  max_score: number;
};

export async function getActiveRubric(simulationSlug: string): Promise<ActiveRubric> {
  const { data, error } = await adminClient
    .from("rubrics")
    .select("id, version, system_prompt, model, max_score")
    .eq("simulation_slug", simulationSlug)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(
      `No active rubric for simulation '${simulationSlug}': ${error?.message ?? "not found"}`
    );
  }
  return data;
}
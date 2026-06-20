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
  criteria: Array<{ name: string; description?: string; max_points: number }> | null;
  verdict_bands: { Distinction: number; Merit: number; Pass: number } | null;
  output_instructions: string | null;
};

export async function getActiveRubric(simulationSlug: string): Promise<ActiveRubric> {
  const { data, error } = await adminClient
    .from("rubrics")
    .select("id, version, system_prompt, model, max_score, criteria, verdict_bands, output_instructions")
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

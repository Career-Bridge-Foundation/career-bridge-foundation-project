import "server-only";

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import type { Prompt, Rubric, Simulation, VideoUrls } from "@/lib/types";

type SimulationRecord = Record<string, unknown>;

const EMPTY_RUBRIC: Rubric = {
  prompt_1: {
    title: "",
    description: "",
    criteria: [],
  },
  prompt_2: {
    title: "",
    description: "",
    criteria: [],
  },
  prompt_3: {
    title: "",
    description: "",
    criteria: [],
  },
};

function normalizeSimulation(row: SimulationRecord): Simulation {
  return {
    id: String(row.id ?? ""),
    slug: (row.slug ?? null) as string | null,
    title: String(row.title ?? ""),
    company_name: String(row.company_name ?? row.company ?? ""),
    discipline: String(row.discipline ?? ""),
    industry: (row.industry ?? null) as string | null,
    candidate_role: (row.candidate_role ?? row.candidateRole ?? null) as string | null,
    estimated_minutes: (row.estimated_minutes ?? row.estimatedMinutes ?? null) as string | null,
    video_urls: (row.video_urls ?? row.videoUrls ?? null) as VideoUrls | null,
    passing_score: Number(row.passing_score ?? row.passingScore ?? 55),
    scenario_brief: String(row.scenario_brief ?? row.scenarioBrief ?? ""),
    prompts: Array.isArray(row.prompts) ? (row.prompts as Prompt[]) : [],
    rubric: (row.rubric ?? EMPTY_RUBRIC) as Rubric,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export const getSimulationById = cache(async (id: string): Promise<Simulation | null> => {
  const { data, error } = await supabaseAdmin
    .from("simulations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch simulation by id: ${error.message}`);
  }

  if (!data) return null;

  return normalizeSimulation(data as SimulationRecord);
});

export const getSimulationByIdOrSlug = cache(async (identifier: string): Promise<Simulation | null> => {
  const normalized = identifier.trim();
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("simulations")
    .select("*")
    .or(`id.eq.${normalized},slug.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch simulation by id/slug: ${error.message}`);
  }

  if (!data) return null;

  return normalizeSimulation(data as SimulationRecord);
});

export async function listSimulations(): Promise<Simulation[]> {
  const { data, error } = await supabaseAdmin
    .from("simulations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch simulations: ${error.message}`);
  }

  return (data ?? []).map((row) => normalizeSimulation(row as SimulationRecord));
}

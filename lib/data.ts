import { supabaseServer } from "./supabase/server";
import type { Simulation } from "@/types";

export async function getSimulations(): Promise<Simulation[]> {
  const { data, error } = await supabaseServer.from("simulations").select("*").order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Simulation[];
}

export async function getSimBySlug(slug: string): Promise<Simulation | null> {
  const { data, error } = await supabaseServer.from("simulations").select("*").eq("slug", slug).limit(1).single();
  if (error && error.code !== "PGRST116") throw error;
  return (data ?? null) as Simulation | null;
}

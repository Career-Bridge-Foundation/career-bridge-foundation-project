import type { Simulation } from "@/types/simulation";
import type { Discipline } from "@/types/simulation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function getSimulations(): Promise<Simulation[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/simulations`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    // console.log("Requests raw: ", json.simulations[13])
    return json.simulations || [];
  } catch (error) {
    console.error("Failed to fetch simulations:", error);
    return [];
  }
}

export async function getSimulation(idOrSlug: string): Promise<Simulation | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/simulations?id=${encodeURIComponent(idOrSlug)}`,
      {
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.simulation || null;
  } catch (error) {
    console.error("Failed to fetch simulation:", error);
    return null;
  }
}

export async function getDisciplines(): Promise<Discipline[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/disciplines`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return json.disciplines || [];
  } catch (error) {
    console.error("Failed to fetch disciplines:", error);
    return [];
  }
}

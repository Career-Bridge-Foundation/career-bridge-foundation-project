"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Checks whether a user has at least one unconsumed simulation credit.
 * Reads the `purchases` table via the browser Supabase client (RLS-protected:
 * users can only see their own rows).
 *
 * Called on simulation page load to decide whether to show the paywall.
 */
export async function checkSimulationAccess(userId: string): Promise<{
  hasAccess: boolean;
  remainingCredits: number;
}> {
  const supabase = createClient();

  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("simulation_credits, simulations_used")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !purchases || purchases.length === 0) {
    return { hasAccess: false, remainingCredits: 0 };
  }

  const remainingCredits = purchases.reduce(
    (sum, p) => sum + (p.simulation_credits - p.simulations_used),
    0
  );

  return { hasAccess: remainingCredits > 0, remainingCredits };
}

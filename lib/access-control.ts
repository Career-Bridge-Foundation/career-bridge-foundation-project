"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Checks whether a user has at least one unconsumed simulation credit.
 * Reads the `purchases` table via the browser Supabase client (RLS-protected:
 * users can only see their own rows).
 *
 * Called on simulation page load to decide whether to show the paywall.
 */
export async function checkSimulationAccess(
  userId: string,
  discipline?: string
): Promise<{
  hasAccess: boolean;
  remainingCredits: number;
  viaEntitlement: boolean;
}> {
  const supabase = createClient();

  // Entitlement path (only if a discipline is provided). RLS scopes the
  // candidate_entitlements read to the user's own rows (policy joins via
  // portfolio_profiles.user_id = auth.uid()), so we filter only by discipline
  // and non-revoked status. discipline is a slug (matches simulations table).
  let viaEntitlement = false;
  if (discipline) {
    const { data: entitlements } = await supabase
      .from("candidate_entitlements")
      .select("id")
      .eq("discipline", discipline)
      .is("revoked_at", null);
    viaEntitlement = !!entitlements && entitlements.length > 0;
  }

  // Credit path (always computed, for the remainingCredits return and as an
  // independent access route for self-serve users).
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select("simulation_credits, simulations_used")
    .eq("user_id", userId)
    .eq("status", "active");

  const remainingCredits =
    error || !purchases
      ? 0
      : purchases.reduce(
          (sum, p) => sum + (p.simulation_credits - p.simulations_used),
          0
        );

  return {
    hasAccess: viaEntitlement || remainingCredits > 0,
    remainingCredits,
    viaEntitlement,
  };
}

/**
 * Returns true if the authenticated user has a simulation_activations row
 * for the given simulation UUID (Spec 15 credit system). Called from the
 * workspace page after simulation content has loaded and the UUID is known.
 *
 * Two queries: portfolio_profiles (get candidate id) then simulation_activations.
 * Both are RLS-scoped to the authenticated user's own rows.
 */
export async function checkActivationAccess(
  userId: string,
  simulationUuid: string,
): Promise<boolean> {
  const supabase = createClient();

  const { data: portfolio } = await supabase
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!portfolio) return false;

  const { data: activation } = await supabase
    .from("simulation_activations")
    .select("id")
    .eq("simulation_id", simulationUuid)
    .eq("candidate_id", portfolio.id)
    .maybeSingle();

  return !!activation;
}

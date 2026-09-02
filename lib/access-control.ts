"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Checks whether a user has discipline-scoped entitlement access. Every
 * candidate is provisioned by a partner (Spec 15/16) — there is no
 * self-serve purchase path anymore.
 *
 * Called on simulation page load to decide whether to show the paywall.
 */
export async function checkSimulationAccess(
  userId: string,
  discipline?: string
): Promise<{
  hasAccess: boolean;
}> {
  if (!discipline) return { hasAccess: false };

  const supabase = createClient();

  // RLS scopes the candidate_entitlements read to the user's own rows
  // (policy joins via portfolio_profiles.user_id = auth.uid()), so we
  // filter only by discipline and non-revoked status. discipline is a
  // slug (matches simulations table).
  const { data: entitlements } = await supabase
    .from("candidate_entitlements")
    .select("id")
    .eq("discipline", discipline)
    .is("revoked_at", null);

  return { hasAccess: !!entitlements && entitlements.length > 0 };
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

  // .limit(1), not .maybeSingle() — a candidate can legitimately have more
  // than one row here (a retake is a second activation on the same
  // simulation), and .maybeSingle() errors out on >1 row instead of just
  // picking one, which would silently deny access on any second attempt.
  const { data: activations } = await supabase
    .from("simulation_activations")
    .select("id")
    .eq("simulation_id", simulationUuid)
    .eq("candidate_id", portfolio.id)
    .limit(1);

  return !!activations && activations.length > 0;
}

/**
 * Returns true if the authenticated candidate already spent a credit on
 * this simulation but never submitted it — a simulation_activations row
 * exists with completed_at still null (Spec 15 credit model). SimulationCard
 * uses this to resume that attempt for free instead of reopening the
 * paywall; only a genuine retake, after completed_at is set on submission
 * (see app/api/evaluate/route.ts), should charge another credit.
 */
export async function hasIncompleteActivation(
  simulationUuid: string,
): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: portfolio } = await supabase
    .from("portfolio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) return false;

  // .limit(1), not .maybeSingle() — a candidate can have more than one
  // incomplete attempt on the same simulation (e.g. duplicate activations
  // from a retry loop before this fix existed), and .maybeSingle() errors
  // out on >1 row instead of just picking one, which silently defeats this
  // whole check.
  const { data: activations } = await supabase
    .from("simulation_activations")
    .select("id")
    .eq("simulation_id", simulationUuid)
    .eq("candidate_id", portfolio.id)
    .is("completed_at", null)
    .limit(1);

  return !!activations && activations.length > 0;
}

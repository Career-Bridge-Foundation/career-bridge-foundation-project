import { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * POST /api/purchases/consume
 *
 * Deducts one simulation credit from the authenticated user's oldest active
 * purchase that still has credits remaining. Called by the simulation page
 * immediately before the evaluation API is invoked.
 *
 * Uses the service role key for the UPDATE so we don't need a permissive
 * UPDATE RLS policy on the purchases table.
 */
export async function POST(_request: NextRequest) {
  // Identify the caller via their session cookie — never trust client-provided IDs
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("[consume] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });

  // Fetch all active purchases for this user, oldest first
  const { data: purchases, error: fetchError } = await admin
    .from("purchases")
    .select("id, simulation_credits, simulations_used")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("purchased_at", { ascending: true });

  if (fetchError) {
    console.error("[consume] Failed to fetch purchases:", fetchError);
    return new Response(JSON.stringify({ error: "Failed to check credits" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find the first purchase that still has credits remaining
  const purchase = purchases?.find(
    (p) => p.simulations_used < p.simulation_credits
  );

  if (!purchase) {
    return new Response(JSON.stringify({ error: "No simulation credits remaining" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await admin
    .from("purchases")
    .update({ simulations_used: purchase.simulations_used + 1 })
    .eq("id", purchase.id);

  if (updateError) {
    console.error("[consume] Failed to increment simulations_used:", updateError);
    return new Response(JSON.stringify({ error: "Failed to consume credit" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      creditsRemaining: purchase.simulation_credits - purchase.simulations_used - 1,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

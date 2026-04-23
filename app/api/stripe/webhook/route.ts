import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PriceType } from "@/types/database";
import { CREDIT_BY_PRICE_TYPE } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// The webhook runs outside a user auth session, so we use the service role key
// to bypass RLS. SUPABASE_SERVICE_ROLE_KEY must be set in your environment.
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Signature verification failed:", message);
    return new Response(
      JSON.stringify({ error: "Webhook signature verification failed", details: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // user_id is set in metadata by the checkout route; client_reference_id is
    // a fallback in case metadata is ever dropped by Stripe.
    const userId = session.metadata?.user_id ?? session.client_reference_id;
    const rawPriceType = session.metadata?.price_type;
    const priceType: PriceType =
      rawPriceType && rawPriceType in CREDIT_BY_PRICE_TYPE
        ? (rawPriceType as PriceType)
        : "single";

    if (!userId) {
      console.error("[webhook] checkout.session.completed — no user_id in metadata, session:", session.id);
      // Return 200 so Stripe doesn't retry; log for manual reconciliation.
      return new Response(JSON.stringify({ received: true, warning: "no user_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const simulationCredits = CREDIT_BY_PRICE_TYPE[priceType] ?? 1;

    try {
      const admin = getAdminClient();

      // ── 1. Record the purchase ────────────────────────────────
      const { error: purchaseError } = await admin.from("purchases").insert({
        user_id: userId,
        stripe_checkout_session_id: session.id,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        price_type: priceType,
        amount_paid: session.amount_total ?? 0,
        currency: session.currency ?? "gbp",
        simulation_credits: simulationCredits,
        simulations_used: 0,
        status: "active",
      });

      if (purchaseError) {
        console.error("[webhook] Failed to insert purchase:", purchaseError);
      } else {
        console.log(`[webhook] Purchase recorded — user: ${userId}, type: ${priceType}, credits: ${simulationCredits}`);
      }

      // ── 2. Coach purchase: promote user + create coach record ──
      if (priceType === "coach") {
        await admin
          .from("profiles")
          .update({ user_type: "coach" })
          .eq("id", userId);

        const { data: existingCoach } = await admin
          .from("coaches")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingCoach) {
          await admin.from("coaches").insert({
            user_id: userId,
            max_seats: 10,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          });
        } else {
          // Update stripe_customer_id if we now have it
          if (typeof session.customer === "string") {
            await admin
              .from("coaches")
              .update({ stripe_customer_id: session.customer })
              .eq("user_id", userId);
          }
        }
      }
    } catch (err) {
      console.error("[webhook] Supabase operation failed:", err);
      // Return 500 so Stripe retries the webhook delivery
      return new Response(JSON.stringify({ error: "Database write failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

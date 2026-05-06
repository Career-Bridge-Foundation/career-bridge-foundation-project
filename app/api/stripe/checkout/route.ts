import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CHECKOUT_PRICES, PRICING_PLANS } from "@/lib/pricing";
import type { PriceType } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function buildLineItem(planId: PriceType): Stripe.Checkout.SessionCreateParams.LineItem {
  const plan = PRICING_PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`No pricing plan found for planId: ${planId}`);

  const features = plan.features.map((f) => `• ${f}`).join("\n");
  const raw = plan.checkout.description ?? features;
  const description = raw.slice(0, 500);

  return {
    quantity: plan.checkout.quantity ?? 1,
    price_data: {
      currency: "gbp",
      unit_amount: plan.checkout.amount,
      product_data: { name: plan.checkout.name },
    },
  };
}

export async function POST(request: NextRequest) {
  // Require authentication — user_id must be in Stripe metadata so the
  // webhook can attribute the payment to the correct account.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "You must be signed in to purchase." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { priceType?: PriceType; simulationId?: string; cancelUrl?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { priceType, simulationId = "", cancelUrl } = body;

  if (!priceType || !(priceType in CHECKOUT_PRICES)) {
    return new Response(JSON.stringify({ error: "Invalid or missing priceType" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (priceType === "coach") {
    return new Response(
      JSON.stringify({ error: "Coach Pack requires a direct enquiry — please email outreach@careerbridgefoundation.com" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { amount, quantity: checkoutQty, discount } = CHECKOUT_PRICES[priceType];
  const subtotalPence = amount * (checkoutQty ?? 1);
  const discountPence = discount ?? 0;
  const totalPence = subtotalPence - discountPence;
  const origin = request.headers.get("origin") ?? "";

  try {
    const lineItem = buildLineItem(priceType);

    // Stripe Checkout doesn't support discount_amounts on line items —
    // discounts must be applied at the session level via a coupon.
    let discounts: { coupon: string }[] | undefined;
    if (discount && discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discount,
        currency: "gbp",
        duration: "once",
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "gbp",
      line_items: [lineItem],
      ...(discounts ? { discounts } : {}),
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${origin}/pricing`,
      client_reference_id: user.id,
      metadata: { price_type: priceType, simulation_id: simulationId, user_id: user.id },
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        breakdown: {
          subtotalPence,
          ...(discountPence > 0 ? { couponPence: discountPence } : {}),
          totalPence,
          currency: "gbp",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Stripe checkout session creation failed", details: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

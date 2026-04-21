import Stripe from "stripe";
import { NextRequest } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(JSON.stringify({ error: "Webhook signature verification failed", details: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    // Skip verification in local development when secret is not set
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { priceType, simulationId } = session.metadata ?? {};
    console.log(`Payment successful — priceType: ${priceType}, simulationId: ${simulationId}, sessionId: ${session.id}`);
    // TODO: connect to Supabase to grant candidate access
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

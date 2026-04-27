import Stripe from "stripe";
import { NextRequest } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });

    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const pm = pi?.payment_method as Stripe.PaymentMethod | null;
    const card = pm?.card;

    const brand = card?.brand
      ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
      : "Card";
    const paymentMethod = card ? `${brand} •••• ${card.last4}` : brand;

    const createdAt = new Date((session.created ?? Date.now() / 1000) * 1000);
    const time = createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const amount = session.amount_total != null
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency: session.currency?.toUpperCase() ?? "GBP" }).format(session.amount_total / 100)
      : null;

    const maskedId = pi?.id
      ? `**** **** ${pi.id.replace("pi_", "").slice(-8).toUpperCase()}`
      : null;

    return new Response(
      JSON.stringify({
        transactionId: maskedId,
        time,
        date,
        paymentMethod,
        planName: session.metadata?.price_type ?? null,
        sessionId: session.id,
        amount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

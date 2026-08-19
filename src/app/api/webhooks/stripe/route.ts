import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/payments";

// Stripe requires the raw request body (untouched by any JSON parsing) to
// verify the signature — Next.js route handlers give us that via
// request.text() as long as we don't read the body any other way first.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Falta la firma del webhook." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firma inválida";
     
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  try {
    await processStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
     
    console.error("Error processing Stripe webhook:", error);
    // 500 tells Stripe to retry the event later.
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

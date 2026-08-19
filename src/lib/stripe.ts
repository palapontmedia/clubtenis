import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY no está configurada.");
}

// Server-only singleton. Never import this from a "use client" file — the
// secret key must never reach the browser bundle. Uses the SDK's pinned
// default API version rather than hardcoding one here.
export const stripe = new Stripe(secretKey);

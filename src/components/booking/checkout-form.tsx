"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

export function CheckoutForm({ clientSecret, reservationId }: { clientSecret: string; reservationId: string }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#b05a36",
            colorText: "#2a2b2f",
            borderRadius: "12px",
            fontFamily: "var(--font-inter), sans-serif",
          },
        },
      }}
    >
      <PayForm reservationId={reservationId} />
    </Elements>
  );
}

function PayForm({ reservationId }: { reservationId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/${reservationId}/confirmation`,
      },
    });

    if (submitError) {
      setError(submitError.message ?? "El pago no se ha podido procesar.");
      setSubmitting(false);
    }
    // On success, Stripe redirects the browser to return_url — no further
    // action needed here. The reservation itself is only ever confirmed by
    // the webhook handler, never by this redirect.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={!stripe || submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pagar y confirmar reserva"}
      </Button>
    </form>
  );
}

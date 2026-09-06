import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUserOrRedirect } from "@/lib/auth-guards";
import { createPendingReservation } from "@/lib/reservations";
import { createReservationSchema } from "@/lib/validation/reservations";
import { AppError } from "@/lib/errors";
import { resolveInternalRedirect } from "@/lib/callback-url";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface NewBookingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Hand-off target for "Reservar pista" when clicked anonymously: ReserveButton
 * sends the user to /login?callbackUrl=<this page's URL, with the exact
 * court/date/time/duration they picked>. requireUserOrRedirect() below sends
 * an unauthenticated visitor to login with that same URL as the callback, so
 * after signing in (or registering) they land right back here — nothing
 * about the original selection had to be re-searched.
 *
 * The slot itself is never trusted from the URL: createPendingReservation()
 * re-validates availability and re-computes the price server-side exactly
 * as it does for the already-authenticated flow in POST /api/reservations.
 */
export default async function NewBookingPage({ searchParams }: NewBookingPageProps) {
  const params = await searchParams;
  const backHref = resolveInternalRedirect(asString(params.back) || null, "/search");

  const parsed = createReservationSchema.safeParse({
    clubId: asString(params.clubId),
    courtId: asString(params.courtId),
    startsAt: asString(params.startsAt),
    durationMinutes: asString(params.durationMinutes),
  });

  if (!parsed.success) {
    redirect(backHref);
  }

  const currentPath = `/booking/new?${new URLSearchParams({
    clubId: parsed.data.clubId,
    courtId: parsed.data.courtId,
    startsAt: parsed.data.startsAt,
    durationMinutes: String(parsed.data.durationMinutes),
    back: backHref,
  }).toString()}`;
  const user = await requireUserOrRedirect(currentPath);

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + parsed.data.durationMinutes * 60_000);

  let reservationId: string;
  try {
    const reservation = await createPendingReservation({
      createdById: user.id,
      clubId: parsed.data.clubId,
      courtId: parsed.data.courtId,
      startsAt,
      endsAt,
    });
    reservationId = reservation.id;
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div className="mx-auto max-w-lg px-6 py-16 text-center sm:py-24">
          <h1 className="display-em font-display text-2xl font-normal">
            No se ha podido completar la reserva
          </h1>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
          <Button asChild variant="accent" className="mt-6">
            <Link href={backHref}>Buscar otra hora</Link>
          </Button>
        </div>
      );
    }
    throw error;
  }

  redirect(`/booking/${reservationId}`);
}

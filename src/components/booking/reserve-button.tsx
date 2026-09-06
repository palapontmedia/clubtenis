"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ReserveButtonProps {
  clubId: string;
  courtId: string;
  startsAt: string; // ISO
  durationMinutes: number;
}

export function ReserveButton({ clubId, courtId, startsAt, durationMinutes }: ReserveButtonProps) {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (status === "unauthenticated") {
      // Send the exact booking the user picked through the login/register
      // detour, not just the search results they were on: /booking/new
      // re-validates and creates it server-side once they're back and
      // authenticated, so there's nothing to re-search for.
      const bookingIntent = new URLSearchParams({
        clubId,
        courtId,
        startsAt,
        durationMinutes: String(durationMinutes),
        back: window.location.pathname + window.location.search,
      });
      const destination = `/booking/new?${bookingIntent.toString()}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(destination)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, courtId, startsAt, durationMinutes }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "No se ha podido crear la reserva.");
        if (data.code === "SLOT_TAKEN") {
          router.refresh();
        }
        return;
      }

      router.push(`/booking/${data.reservation.id}`);
    } catch {
      toast.error("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading || status === "loading"} size="sm" variant="accent">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reservar"}
    </Button>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ReservationCard, type ReservationCardData } from "@/components/booking/reservation-card";

function useReservations(scope: "upcoming" | "history") {
  return useQuery({
    queryKey: ["reservations", scope],
    queryFn: async (): Promise<ReservationCardData[]> => {
      const res = await fetch(`/api/reservations?scope=${scope}`);
      if (!res.ok) throw new Error("No se han podido cargar las reservas.");
      const data = await res.json();
      return data.reservations;
    },
  });
}

function ReservationsPanel({ scope }: { scope: "upcoming" | "history" }) {
  const { data, isLoading, isError } = useReservations(scope);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return <Card className="p-8 text-center text-sm text-destructive">No se han podido cargar tus reservas.</Card>;
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {scope === "upcoming" ? "No tienes reservas próximas." : "Aún no tienes reservas anteriores."}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((reservation) => (
        <ReservationCard key={reservation.id} reservation={reservation} />
      ))}
    </div>
  );
}

export function ReservationsList() {
  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Próximas</TabsTrigger>
        <TabsTrigger value="history">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming">
        <ReservationsPanel scope="upcoming" />
      </TabsContent>
      <TabsContent value="history">
        <ReservationsPanel scope="history" />
      </TabsContent>
    </Tabs>
  );
}

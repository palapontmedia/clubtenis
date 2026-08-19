import { requireUserOrRedirect } from "@/lib/auth-guards";
import { ReservationsList } from "@/components/booking/reservations-list";

export default async function ReservationsPage() {
  await requireUserOrRedirect("/reservations");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mis reservas</h1>
      <div className="mt-6">
        <ReservationsList />
      </div>
    </div>
  );
}

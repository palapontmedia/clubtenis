import { requireUserOrRedirect } from "@/lib/auth-guards";
import { Container } from "@/components/layout/container";
import { PageHeading } from "@/components/ui/typography";
import { ReservationsList } from "@/components/booking/reservations-list";

export default async function ReservationsPage() {
  await requireUserOrRedirect("/reservations");

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <PageHeading>
        Mis <em>reservas</em>
      </PageHeading>
      <div className="mt-8">
        <ReservationsList />
      </div>
    </Container>
  );
}

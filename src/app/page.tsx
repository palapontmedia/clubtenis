import { SearchForm } from "@/components/booking/search-form";
import { Section, SectionHead } from "@/components/layout/section";
import { getDefaultClub, getSports } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [club, sports] = await Promise.all([getDefaultClub(), getSports()]);

  return (
    <Section>
      <SectionHead
        centered
        eyebrow={club.name}
        title={
          <>
            Reserva tu pista <em>en segundos</em>
          </>
        }
        lead="Disponibilidad en tiempo real, precios claros y pago seguro. Elige deporte, fecha y hora — el resto es jugar."
      />
      <div className="mx-auto max-w-xl">
        <SearchForm sports={sports} clubId={club.id} timezone={club.timezone} />
      </div>
    </Section>
  );
}

import Image from "next/image";

import { SearchForm } from "@/components/booking/search-form";
import { Container } from "@/components/layout/container";
import { Section, SectionHead } from "@/components/layout/section";
import { getDefaultClub, getSports } from "@/lib/club";

export const dynamic = "force-dynamic";

const STATS = [
  { num: "11", label: "Pistas de tenis" },
  { num: "6", label: "Pistas de pádel" },
  { num: "1973", label: "Fundado en" },
  { num: "100%", label: "Reserva online" },
];

export default async function HomePage() {
  const [club, sports] = await Promise.all([getDefaultClub(), getSports()]);

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative flex min-h-[80vh] flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/img/club/hero-pistas-atardecer.jpg"
            alt="Pistas de tenis y pádel del Club de Tenis de Oliva al atardecer"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,43,47,0.4)_0%,rgba(42,43,47,0.58)_55%,rgba(42,43,47,0.85)_100%)]" />
        </div>

        <Container className="flex flex-col items-center py-20 text-center sm:py-24">
          <Image
            src="/img/club/logo-club-white.png"
            alt="Escudo del Club de Tenis de Oliva"
            width={160}
            height={160}
            priority
            className="mb-6 h-32 w-32 object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)] sm:h-40 sm:w-40"
          />
          <h1 className="display-em font-display text-4xl font-normal leading-none text-background sm:text-6xl">
            Club de Tenis <em className="text-[#d4a68e]">Oliva</em>
          </h1>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.04em] text-[#d4a68e]">
            Desde 1973
          </p>
          <p className="mt-6 max-w-[520px] text-lg font-light text-background/85">
            Once pistas de tenis y seis de pádel, escuela para todas las edades y reserva de pista
            online, todos los días del año.
          </p>

          <div className="mt-12 flex w-full flex-wrap items-center justify-center gap-8 border-t border-background/20 pt-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span className="font-display text-3xl font-normal leading-none text-background">
                  {stat.num}
                </span>
                <span className="text-sm text-background/70">{stat.label}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Section id="reservar" className="scroll-mt-24">
        <SectionHead
          eyebrow={club.name}
          title={
            <>
              Reserva tu pista <em>en segundos</em>
            </>
          }
          lead="Disponibilidad en tiempo real, precios claros y pago seguro. Elige deporte, fecha y hora — el resto es jugar."
        />
        <div className="max-w-xl">
          <SearchForm sports={sports} clubId={club.id} timezone={club.timezone} />
        </div>
      </Section>
    </div>
  );
}

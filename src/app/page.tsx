import { SearchForm } from "@/components/booking/search-form";
import { getDefaultClub, getSports } from "@/lib/club";

export default async function HomePage() {
  const [club, sports] = await Promise.all([getDefaultClub(), getSports()]);

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">{club.name}</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Reserva tu pista en menos de 30 segundos
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Disponibilidad en tiempo real, precios claros y pago seguro. Elige deporte, fecha y hora — el resto es
            jugar.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-8 w-full max-w-6xl px-4 pb-16 sm:-mt-12">
        <div className="mx-auto max-w-xl">
          <SearchForm sports={sports} />
        </div>
      </section>
    </div>
  );
}

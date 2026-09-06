import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M15 8h2V4h-2a4 4 0 0 0-4 4v2H9v4h2v8h4v-8h3l1-4h-4V8a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <Container className="pt-16">
        <div className="grid gap-10 border-b border-background/10 pb-16 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/img/club/logo-club.png"
                alt="Escudo del Club de Tenis de Oliva"
                width={40}
                height={40}
                className="h-10 w-10 flex-shrink-0 rounded-[10px] border border-background/20 bg-background object-contain p-[3px]"
              />
              <span className="flex flex-col leading-none">
                <span className="font-display text-xl">Oliva</span>
                <span className="mt-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-background/60">
                  Club de Tenis
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-[320px] text-sm leading-relaxed text-background/70">
              Club de Tenis de Oliva: pistas de tenis y pádel frente al mar, escuela para todas las
              edades y reserva de pista online todos los días del año.
            </p>
            <div className="mt-6 flex gap-2">
              <a
                href="https://www.facebook.com/p/Club-de-Tenis-Oliva-100068148101647/"
                target="_blank"
                rel="noopener"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-background/20 text-background transition-colors hover:bg-background/10"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-background/20 text-background transition-colors hover:bg-background/10"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.04em]">Horario</h4>
            <p className="text-sm leading-relaxed text-background/70">
              Todos los días
              <br />
              09:00 – 20:00
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.04em]">Contacto</h4>
            <p className="text-sm leading-relaxed text-background/70">
              Passeig Oliva al Mar, s/n
              <br />
              46780 Oliva, Valencia
            </p>
            <p className="mt-4 text-sm leading-relaxed">
              <a href="tel:+34962851185" className="text-background/70 hover:text-background">
                962 85 11 85
              </a>
            </p>
            <p className="text-sm leading-relaxed">
              <a
                href="mailto:administracion@clubtenisoliva.es"
                className="text-background/70 hover:text-background"
              >
                administracion@clubtenisoliva.es
              </a>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 py-6 text-sm text-background/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Club de Tenis de Oliva. Todos los derechos reservados.</p>
          <p>
            Reservas por{" "}
            <Link href="/" className="hover:text-background">
              Rally
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, LogOut, Menu, ShieldCheck, User } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Container } from "@/components/layout/container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const NAV_LINKS = [
  { href: "/", label: "Reservar" },
  { href: "/reservations", label: "Mis reservas" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/img/club/logo-club.png"
        alt="Escudo del Club de Tenis de Oliva"
        width={40}
        height={40}
        className="h-10 w-10 flex-shrink-0 rounded-[10px] border border-border bg-background object-contain p-[3px]"
        priority
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl text-foreground">Oliva</span>
        <span className="mt-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Club de Tenis
        </span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isStaff =
    session?.user.role === "STAFF" ||
    session?.user.role === "ADMIN" ||
    session?.user.role === "SUPER_ADMIN";

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <Container className="flex h-[72px] items-center justify-between gap-6">
          <BrandMark />

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  pathname === link.href ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {isStaff && (
              <Link
                href="/admin"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Panel admin
              </Link>
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {status === "loading" ? null : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar>
                      <AvatarFallback>
                        {initials(session.user.name ?? session.user.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Panel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Mi perfil
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Panel admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/register">Crear cuenta</Link>
                </Button>
              </>
            )}
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-64 flex-col gap-4">
              <SheetTitle>Menú</SheetTitle>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium"
                >
                  {link.label}
                </Link>
              ))}
              {isStaff && (
                <Link href="/admin" onClick={() => setOpen(false)} className="text-sm font-medium">
                  Panel admin
                </Link>
              )}
              <Separator />
              {session?.user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium"
                  >
                    Mi panel
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium"
                  >
                    Mi perfil
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="text-left text-sm font-medium text-destructive"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-medium">
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </SheetContent>
          </Sheet>
        </Container>
      </div>
    </header>
  );
}

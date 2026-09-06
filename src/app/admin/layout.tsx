import Link from "next/link";
import {
  CalendarRange,
  LayoutDashboard,
  MapPin,
  Settings,
  ShieldAlert,
  Tag,
  Users,
  Wallet,
  Wrench,
  Clock,
  Percent,
} from "lucide-react";

import { requireStaffOrRedirect } from "@/lib/auth-guards";

const SECTIONS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/reservations", label: "Reservas", icon: CalendarRange },
  { href: "/admin/calendar", label: "Calendario", icon: CalendarRange },
  { href: "/admin/courts", label: "Pistas", icon: MapPin },
  { href: "/admin/pricing", label: "Precios", icon: Percent },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/payments", label: "Pagos", icon: Wallet },
  { href: "/admin/promotions", label: "Promociones", icon: Tag },
  { href: "/admin/hours", label: "Horarios", icon: Clock },
  { href: "/admin/maintenance", label: "Mantenimiento", icon: Wrench },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffOrRedirect();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-4 flex gap-1 overflow-x-auto pb-2 md:hidden">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="shrink-0 rounded-md bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="flex gap-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="mb-4 flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          {user.role.replace("_", " ")}
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-primary"
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

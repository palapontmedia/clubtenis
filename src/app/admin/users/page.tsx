import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleSelectForm } from "@/components/admin/role-select-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const actor = await requireRole("ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {actor.role === "SUPER_ADMIN"
          ? "Puedes gestionar cualquier rol."
          : "Solo un super administrador puede gestionar roles de administración."}
      </p>

      <div className="mt-6 space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{u.name}</p>
                <Badge variant="outline">{u.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {u.email}
                {u.phone ? ` · ${u.phone}` : ""}
              </p>
            </div>
            <RoleSelectForm userId={u.id} currentRole={u.role} canManageElevated={actor.role === "SUPER_ADMIN"} />
          </Card>
        ))}
      </div>
    </div>
  );
}

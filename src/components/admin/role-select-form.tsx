"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateUserRole } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES = ["PLAYER", "STAFF", "ADMIN", "SUPER_ADMIN"];

export function RoleSelectForm({ userId, currentRole, canManageElevated }: { userId: string; currentRole: string; canManageElevated: boolean }) {
  const [role, setRole] = useState(currentRole);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      await updateUserRole(formData);
      toast.success("Rol actualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido actualizar el rol.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <Select value={role} onValueChange={setRole} disabled={!canManageElevated && (currentRole === "ADMIN" || currentRole === "SUPER_ADMIN")}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.filter((r) => canManageElevated || (r !== "ADMIN" && r !== "SUPER_ADMIN")).map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={submitting || role === currentRole}>
        Guardar
      </Button>
    </form>
  );
}

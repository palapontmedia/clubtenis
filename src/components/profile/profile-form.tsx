"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateProfileSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import type { z } from "zod";

type FormValues = z.infer<typeof updateProfileSchema>;

export function ProfileForm({ initial }: { initial: FormValues }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(updateProfileSchema), defaultValues: initial });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error("No se ha podido guardar el perfil.");
      return;
    }
    toast.success("Perfil actualizado.");
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" type="tel" {...register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skillLevel">Nivel de juego</Label>
            <Input id="skillLevel" placeholder="Iniciación, Intermedio, Avanzado…" {...register("skillLevel")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bio">Sobre ti</Label>
            <Textarea id="bio" rows={3} {...register("bio")} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Comunicaciones y promociones</p>
              <p className="text-xs text-muted-foreground">Recibe novedades y ofertas del club.</p>
            </div>
            <Controller
              control={control}
              name="marketingOptIn"
              render={({ field }) => (
                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es demasiado corto").max(100),
  email: z.string().trim().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72)
    .regex(/[a-z]/, "Debe incluir una minúscula")
    .regex(/[A-Z]/, "Debe incluir una mayúscula")
    .regex(/[0-9]/, "Debe incluir un número"),
  phone: z.string().trim().max(30).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72)
    .regex(/[a-z]/, "Debe incluir una minúscula")
    .regex(/[A-Z]/, "Debe incluir una mayúscula")
    .regex(/[0-9]/, "Debe incluir un número"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  skillLevel: z.string().trim().max(50).optional().nullable(),
  marketingOptIn: z.boolean().optional(),
});

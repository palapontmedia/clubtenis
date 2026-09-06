import { z } from "zod";

export const ALLOWED_DURATIONS_MINUTES = [60, 90, 120] as const;

export const availabilityQuerySchema = z.object({
  clubId: z.string().min(1),
  sportId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
  durationMinutes: z.coerce.number().refine((v) => (ALLOWED_DURATIONS_MINUTES as readonly number[]).includes(v), {
    message: "Duración no soportada",
  }),
});

export const createReservationSchema = z.object({
  clubId: z.string().min(1),
  courtId: z.string().min(1),
  startsAt: z.string().datetime(),
  durationMinutes: z.coerce.number().refine((v) => (ALLOWED_DURATIONS_MINUTES as readonly number[]).includes(v), {
    message: "Duración no soportada",
  }),
  promoCode: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const createPaymentIntentSchema = z.object({
  reservationId: z.string().min(1),
});

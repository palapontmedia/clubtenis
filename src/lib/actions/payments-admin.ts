"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { refundPayment } from "@/lib/payments";
import { logAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-error";

const refundSchema = z.object({
  paymentId: z.string().min(1),
  amountEuros: z.coerce.number().positive(),
  reason: z.string().trim().min(1).max(300),
});

export async function manualRefund(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const data = refundSchema.parse(Object.fromEntries(formData.entries()));

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: data.paymentId } });
  const amountCents = Math.round(data.amountEuros * 100);
  const alreadyRefunded = await prisma.refund.aggregate({ where: { paymentId: data.paymentId }, _sum: { amountCents: true } });
  const remaining = payment.amountCents - (alreadyRefunded._sum.amountCents ?? 0);

  if (amountCents > remaining) {
    throw new AppError(`Solo quedan ${(remaining / 100).toFixed(2)} € reembolsables para este pago.`, 422, "REFUND_TOO_LARGE");
  }

  await refundPayment(data.paymentId, amountCents, data.reason);
  await logAudit({ actorUserId: staff.id, action: "MANUAL_REFUND", entityType: "Payment", entityId: data.paymentId, metadata: data });

  revalidatePath("/admin/payments");
}

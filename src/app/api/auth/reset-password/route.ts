import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { toErrorResponse, AppError } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await request.json());

    const { success } = rateLimit(`reset-password:${body.token.slice(0, 16)}`, 10, 15 * 60_000);
    if (!success) {
      throw new AppError("Demasiados intentos. Prueba de nuevo en unos minutos.", 429, "RATE_LIMITED");
    }

    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError("El enlace de restablecimiento no es válido o ha caducado.", 400, "INVALID_TOKEN");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    await prisma.$transaction([
      // Bump the session cutoff so every JWT issued before this reset —
      // including one held by whoever the user is resetting against — stops
      // being accepted.
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, sessionsValidFrom: new Date() },
      }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

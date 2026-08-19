import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { toErrorResponse, AppError } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";

const RESET_TOKEN_TTL_MS = 30 * 60_000;

export async function POST(request: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const { success } = rateLimit(`forgot-password:${email}`, 5, 15 * 60_000);
    if (!success) {
      throw new AppError("Demasiados intentos. Prueba de nuevo en unos minutos.", 429, "RATE_LIMITED");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way whether or not the account exists, so
    // this endpoint can't be used to enumerate registered emails.
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      await notify({
        userId: user.id,
        type: "PASSWORD_RESET",
        title: "Restablecer contraseña",
        body: `Usa este enlace para restablecer tu contraseña (caduca en 30 minutos): /reset-password?token=${rawToken}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

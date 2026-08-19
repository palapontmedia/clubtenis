import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { toErrorResponse, AppError } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { success } = rateLimit(`register:${ip}`, 10, 10 * 60_000);
    if (!success) {
      throw new AppError("Demasiados intentos. Prueba de nuevo en unos minutos.", 429, "RATE_LIMITED");
    }

    const body = registerSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Same generic message whether or not the account exists, to avoid
      // leaking which emails are registered.
      throw new AppError("No se ha podido completar el registro.", 422, "REGISTRATION_FAILED");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        phone: body.phone,
        passwordHash,
        role: "PLAYER",
        playerProfile: { create: {} },
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

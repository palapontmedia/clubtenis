import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { updateProfileSchema } from "@/lib/validation/auth";
import { toErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { playerProfile: true },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = updateProfileSchema.parse(await request.json());

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        phone: body.phone,
        playerProfile: {
          upsert: {
            create: {
              bio: body.bio ?? undefined,
              skillLevel: body.skillLevel ?? undefined,
              marketingOptIn: body.marketingOptIn ?? false,
            },
            update: {
              bio: body.bio,
              skillLevel: body.skillLevel,
              marketingOptIn: body.marketingOptIn,
            },
          },
        },
      },
      include: { playerProfile: true },
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}

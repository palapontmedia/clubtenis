import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-guards";
import { createPaymentIntentForReservation } from "@/lib/payments";
import { createPaymentIntentSchema } from "@/lib/validation/reservations";
import { toErrorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createPaymentIntentSchema.parse(await request.json());

    const result = await createPaymentIntentForReservation(body.reservationId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

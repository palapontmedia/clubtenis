import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ZodError } from "zod";

import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";

export { AppError } from "@/lib/errors";

/**
 * Maps any thrown error to a safe, user-facing JSON response. Unexpected
 * errors are logged server-side with a correlation id but never leak
 * internals (stack traces, SQL, etc.) to the client.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Debes iniciar sesión.", code: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "No tienes permiso para esto.", code: "FORBIDDEN" }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos.", code: "VALIDATION_ERROR", issues: error.issues },
      { status: 422 }
    );
  }

  const correlationId = randomUUID();

  console.error(`[${correlationId}] Unhandled error:`, error);
  return NextResponse.json(
    { error: "Algo ha ido mal. Inténtalo de nuevo.", code: "INTERNAL_ERROR", correlationId },
    { status: 500 }
  );
}

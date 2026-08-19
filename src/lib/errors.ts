// Plain error classes with no framework dependencies, so business logic
// (src/lib/reservations.ts, etc.) and its tests can throw/catch them
// without pulling in Next.js or Auth.js — see auth-guards.ts and
// api-error.ts, which both build on these.

export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

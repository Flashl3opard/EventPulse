import { Prisma } from "@eventpulse/database";
import { ApiError } from "./errors.js";

// Defense-in-depth: routes check existence/conflicts explicitly before
// writing, but a concurrent request can still race past that check, so
// the underlying DB constraint is the real guarantee. This translates
// Prisma's low-level errors into the same clean API error shape rather
// than leaking a raw Prisma error (or a generic 500) for a case the route
// already has a specific status code for.
export function mapPrismaError(err: unknown): ApiError | null {
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001")
  ) {
    return new ApiError(503, "DATABASE_UNAVAILABLE", "The database is currently unavailable.");
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return new ApiError(409, "CONFLICT", "The request conflicts with existing data.");
    }
    if (err.code === "P2003" || err.code === "P2025") {
      return new ApiError(404, "NOT_FOUND", "A referenced resource was not found.");
    }
  }

  return null;
}

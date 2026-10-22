import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

// Registered as the last middleware. Express 5 forwards rejected promises
// from async route handlers here automatically, so routes can just `throw`.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Never leak raw error messages/stack traces to the client.
  console.error(err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
}

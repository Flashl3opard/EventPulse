import express, { type Express } from "express";
import type { PrismaClient } from "@eventpulse/database";
import { registerHealthRoute } from "./routes/health.js";
import { registerPaymentEventsRoute } from "./routes/payment-events.js";
import { registerEventsRoute } from "./routes/events.js";
import { registerPaymentsRoute } from "./routes/payments.js";
import { errorHandler } from "./lib/errors.js";

export function createApp(prisma: PrismaClient): Express {
  const app = express();
  app.use(express.json());

  registerHealthRoute(app, prisma);
  registerPaymentEventsRoute(app, prisma);
  registerEventsRoute(app, prisma);
  registerPaymentsRoute(app, prisma);

  app.use(errorHandler);

  return app;
}

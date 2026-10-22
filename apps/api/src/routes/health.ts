import type { Express } from "express";
import type { PrismaClient } from "@eventpulse/database";

// Development-only endpoint: no auth, not meant for public exposure.
export function registerHealthRoute(app: Express, prisma: PrismaClient): void {
  app.get("/api/v1/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ api: "ok", database: "ok" });
    } catch {
      res.status(503).json({ api: "ok", database: "unavailable" });
    }
  });
}

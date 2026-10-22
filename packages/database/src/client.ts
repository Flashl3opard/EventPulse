import { PrismaClient } from "@prisma/client";

// Lazily constructed: PrismaClient throws at construction time if
// DATABASE_URL is unset, which would break unit tests for the pure helpers
// in this package (mappers) if the client were instantiated at import time.
let client: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@eventpulse/database";
import { createApp } from "./app.js";

// A hand-rolled double covering only what the routes call. This keeps these
// tests fast and infra-free; the full persistence path (atomic commit,
// unique/CHECK constraints) is exercised for real in
// tests/integration/api.integration.test.ts against a live PostgreSQL.
function createFakePrisma() {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    merchant: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    payment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    paymentEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: randomUUID(),
        ...data,
      })),
    },
    outboxRecord: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return prisma;
}

function validInitiatedEnvelope() {
  return {
    eventId: randomUUID(),
    eventType: "payment.initiated",
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    merchantId: randomUUID(),
    paymentId: randomUUID(),
    payload: { amountMinor: 5_000, currency: "USD" },
  };
}

describe("GET /api/v1/health", () => {
  it("reports ok when the database is reachable", async () => {
    const prisma = createFakePrisma();
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ api: "ok", database: "ok" });
  });

  it("reports the database as unavailable without failing the API itself", async () => {
    const prisma = createFakePrisma();
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ api: "ok", database: "unavailable" });
  });
});

describe("POST /api/v1/payment-events", () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    prisma = createFakePrisma();
    app = createApp(prisma as unknown as PrismaClient);
  });

  it("rejects an invalid payload before touching the database", async () => {
    const res = await request(app)
      .post("/api/v1/payment-events")
      .send({ eventType: "payment.initiated" }); // missing required fields

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EVENT");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });

  it("durably accepts a valid payment.initiated event", async () => {
    const envelope = validInitiatedEnvelope();

    const res = await request(app).post("/api/v1/payment-events").send(envelope);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      eventId: envelope.eventId,
      paymentId: envelope.paymentId,
      status: "ACCEPTED",
    });
    expect(prisma.merchant.upsert).toHaveBeenCalledOnce();
    expect(prisma.payment.create).toHaveBeenCalledOnce();
    expect(prisma.paymentEvent.create).toHaveBeenCalledOnce();
    expect(prisma.outboxRecord.create).toHaveBeenCalledOnce();
  });

  it("returns the original acceptance for a repeated eventId instead of accepting it again", async () => {
    const envelope = validInitiatedEnvelope();
    prisma.paymentEvent.findUnique.mockResolvedValueOnce({
      eventId: envelope.eventId,
      paymentId: envelope.paymentId,
    });

    const res = await request(app).post("/api/v1/payment-events").send(envelope);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ALREADY_ACCEPTED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects payment.initiated for a payment id that already exists", async () => {
    const envelope = validInitiatedEnvelope();
    prisma.payment.findUnique.mockResolvedValueOnce({
      id: envelope.paymentId,
      merchantId: envelope.merchantId,
    });

    const res = await request(app).post("/api/v1/payment-events").send(envelope);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAYMENT_ALREADY_EXISTS");
  });

  it("rejects a non-initiating event for a payment id that has not been initiated", async () => {
    const envelope = {
      eventId: randomUUID(),
      eventType: "payment.authorized",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      merchantId: randomUUID(),
      paymentId: randomUUID(),
      payload: { authorizedAmountMinor: 5_000, authorizationCode: "AUTH123" },
    };
    // payment.findUnique already defaults to null -> not found

    const res = await request(app).post("/api/v1/payment-events").send(envelope);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("rejects an event whose merchantId does not match the payment on file", async () => {
    const envelope = {
      eventId: randomUUID(),
      eventType: "payment.authorized",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      merchantId: randomUUID(),
      paymentId: randomUUID(),
      payload: { authorizedAmountMinor: 5_000, authorizationCode: "AUTH123" },
    };
    prisma.payment.findUnique.mockResolvedValueOnce({
      id: envelope.paymentId,
      merchantId: randomUUID(), // different merchant
    });

    const res = await request(app).post("/api/v1/payment-events").send(envelope);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MERCHANT_MISMATCH");
  });
});

describe("GET /api/v1/events/:eventId", () => {
  it("rejects a malformed event id before querying the database", async () => {
    const prisma = createFakePrisma();
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get("/api/v1/events/not-a-uuid");

    expect(res.status).toBe(400);
    expect(prisma.paymentEvent.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a well-formed id that does not exist", async () => {
    const prisma = createFakePrisma();
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get(`/api/v1/events/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
  });
});

describe("GET /api/v1/payments/:paymentId", () => {
  it("rejects a malformed payment id before querying the database", async () => {
    const prisma = createFakePrisma();
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get("/api/v1/payments/not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed id that does not exist", async () => {
    const prisma = createFakePrisma();
    const app = createApp(prisma as unknown as PrismaClient);

    const res = await request(app).get(`/api/v1/payments/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PAYMENT_NOT_FOUND");
  });
});

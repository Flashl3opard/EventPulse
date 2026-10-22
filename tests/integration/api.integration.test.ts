// INTEGRATION TEST — requires a reachable PostgreSQL instance with migrations
// applied. Not run by `npm run test`. Run with:
//   docker compose up -d postgres
//   npm run migrate:deploy --workspace=packages/database   (or migrate:dev on first run)
//   npm run test:integration
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { getPrismaClient } from "@eventpulse/database";
import { createApp } from "../../apps/api/src/app.js";

const prisma = getPrismaClient();
const app = createApp(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("API: accept, read back, idempotency, and ordering", () => {
  it("reports healthy when PostgreSQL is reachable", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ api: "ok", database: "ok" });
  });

  it("durably accepts payment.initiated, and the event/payment are both readable afterward", async () => {
    const eventId = randomUUID();
    const merchantId = randomUUID();
    const paymentId = randomUUID();

    const acceptRes = await request(app)
      .post("/api/v1/payment-events")
      .send({
        eventId,
        eventType: "payment.initiated",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        merchantId,
        paymentId,
        payload: { amountMinor: 10_000, currency: "USD" },
      });
    expect(acceptRes.status).toBe(202);
    expect(acceptRes.body).toEqual({ eventId, paymentId, status: "ACCEPTED" });

    const eventRes = await request(app).get(`/api/v1/events/${eventId}`);
    expect(eventRes.status).toBe(200);
    expect(eventRes.body.eventType).toBe("payment.initiated");
    expect(eventRes.body.outbox.status).toBe("PENDING");
    expect(eventRes.body.processing.status).toBe("PENDING"); // no consumer yet (Milestone 6)

    const paymentRes = await request(app).get(`/api/v1/payments/${paymentId}`);
    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body.status).toBe("INITIATED");
    expect(paymentRes.body.requestedAmountMinor).toBe(10_000);
    expect(paymentRes.body.ledger).toEqual([]);
  });

  it("replaying the same eventId returns the original acceptance, not a new one", async () => {
    const eventId = randomUUID();
    const body = {
      eventId,
      eventType: "payment.initiated",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      merchantId: randomUUID(),
      paymentId: randomUUID(),
      payload: { amountMinor: 2_500, currency: "USD" },
    };

    const first = await request(app).post("/api/v1/payment-events").send(body);
    expect(first.status).toBe(202);

    const replay = await request(app).post("/api/v1/payment-events").send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.status).toBe("ALREADY_ACCEPTED");

    const eventCount = await prisma.paymentEvent.count({ where: { eventId } });
    expect(eventCount).toBe(1);
  });

  it("rejects a non-initiating event for a payment that was never initiated", async () => {
    const res = await request(app)
      .post("/api/v1/payment-events")
      .send({
        eventId: randomUUID(),
        eventType: "payment.authorized",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        merchantId: randomUUID(),
        paymentId: randomUUID(), // never initiated
        payload: { authorizedAmountMinor: 5_000, authorizationCode: "AUTH123" },
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("accepts a well-formed follow-on event without mutating payment status itself", async () => {
    const paymentId = randomUUID();
    const merchantId = randomUUID();

    await request(app)
      .post("/api/v1/payment-events")
      .send({
        eventId: randomUUID(),
        eventType: "payment.initiated",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        merchantId,
        paymentId,
        payload: { amountMinor: 7_500, currency: "USD" },
      })
      .expect(202);

    const authorizeRes = await request(app)
      .post("/api/v1/payment-events")
      .send({
        eventId: randomUUID(),
        eventType: "payment.authorized",
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        merchantId,
        paymentId,
        payload: { authorizedAmountMinor: 7_500, authorizationCode: "AUTH999" },
      });
    expect(authorizeRes.status).toBe(202);

    // The API persisted the event, but status transitions and ledger
    // postings are exclusively the event-consumer's job (Milestone 6) —
    // the payment stays INITIATED until that consumer exists and runs.
    const paymentRes = await request(app).get(`/api/v1/payments/${paymentId}`);
    expect(paymentRes.body.status).toBe("INITIATED");
  });
});

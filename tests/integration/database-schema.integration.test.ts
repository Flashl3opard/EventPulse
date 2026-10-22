// INTEGRATION TEST — requires a reachable PostgreSQL instance with migrations
// applied. Not run by `npm run test`. Run with:
//   docker compose up -d postgres
//   npm run migrate:deploy --workspace=packages/database   (or migrate:dev on first run)
//   npm run test:integration
//
// This exercises the schema itself (constraints, atomicity, dedup guards)
// rather than application services, which don't exist yet (Milestones 4-6).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrismaClient } from "@eventpulse/database";

const prisma = getPrismaClient();

describe("database schema", () => {
  let merchantId: string;

  beforeAll(async () => {
    const merchant = await prisma.merchant.create({
      data: { name: "Integration Test Merchant" },
    });
    merchantId = merchant.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createInitiatedPayment(requestedAmountMinor = 10_000) {
    const eventId = randomUUID();
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { merchantId, currency: "USD", requestedAmountMinor, status: "INITIATED" },
      });
      const event = await tx.paymentEvent.create({
        data: {
          eventId,
          merchantId,
          paymentId: payment.id,
          eventType: "PAYMENT_INITIATED",
          schemaVersion: 1,
          occurredAt: new Date(),
          payload: { amountMinor: requestedAmountMinor, currency: "USD" },
        },
      });
      await tx.outboxRecord.create({
        data: {
          paymentEventId: event.id,
          topic: "eventpulse.payment-events.v1",
          partitionKey: payment.id,
        },
      });
      return { payment, event };
    });
  }

  it("commits a payment, its event, and its outbox record atomically", async () => {
    const { payment, event } = await createInitiatedPayment();
    const outbox = await prisma.outboxRecord.findUniqueOrThrow({
      where: { paymentEventId: event.id },
    });
    expect(outbox.status).toBe("PENDING");
    expect(outbox.partitionKey).toBe(payment.id);
  });

  it("rolls back the event and outbox together when the transaction fails", async () => {
    const { payment, event } = await createInitiatedPayment();

    await expect(
      prisma.$transaction(async (tx) => {
        const duplicate = await tx.paymentEvent.create({
          data: {
            eventId: event.eventId, // duplicate -> unique constraint violation
            merchantId,
            paymentId: payment.id,
            eventType: "PAYMENT_AUTHORIZED",
            schemaVersion: 1,
            occurredAt: new Date(),
            payload: {},
          },
        });
        await tx.outboxRecord.create({
          data: { paymentEventId: duplicate.id, topic: "t", partitionKey: payment.id },
        });
      }),
    ).rejects.toThrow();

    const outboxCount = await prisma.outboxRecord.count({
      where: { paymentEvent: { paymentId: payment.id } },
    });
    expect(outboxCount).toBe(1); // only the original — the failed attempt left no trace
  });

  it("rejects a second payment_events row with a duplicate eventId outside a transaction too", async () => {
    const { event } = await createInitiatedPayment();

    await expect(
      prisma.paymentEvent.create({
        data: {
          eventId: event.eventId,
          merchantId,
          paymentId: event.paymentId,
          eventType: "PAYMENT_AUTHORIZED",
          schemaVersion: 1,
          occurredAt: new Date(),
          payload: {},
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a refund that would exceed the captured amount (CHECK constraint)", async () => {
    const { payment } = await createInitiatedPayment(10_000);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "CAPTURED", authorizedAmountMinor: 10_000, capturedAmountMinor: 10_000 },
    });

    await expect(
      prisma.payment.update({
        where: { id: payment.id },
        data: { refundedAmountMinor: 10_001 },
      }),
    ).rejects.toThrow();
  });

  it("allows cumulative partial refunds up to exactly the captured amount", async () => {
    const { payment } = await createInitiatedPayment(10_000);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "CAPTURED", authorizedAmountMinor: 10_000, capturedAmountMinor: 10_000 },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { refundedAmountMinor: 4_000 },
    });
    const fullyRefunded = await prisma.payment.update({
      where: { id: payment.id },
      data: { refundedAmountMinor: 10_000, status: "REFUNDED" },
    });

    expect(fullyRefunded.refundedAmountMinor).toBe(10_000);
    expect(fullyRefunded.status).toBe("REFUNDED");
  });

  it("prevents a second ledger transaction for the same sourceEventId", async () => {
    const { payment, event } = await createInitiatedPayment(5_000);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "CAPTURED", authorizedAmountMinor: 5_000, capturedAmountMinor: 5_000 },
    });

    const postCaptureLedger = () =>
      prisma.ledgerTransaction.create({
        data: {
          merchantId,
          paymentId: payment.id,
          type: "CAPTURE",
          sourceEventId: event.eventId,
          currency: "USD",
          entries: {
            create: [
              { account: "PLATFORM_CASH", direction: "DEBIT", amountMinor: 5_000 },
              { account: "MERCHANT_PAYABLE", direction: "CREDIT", amountMinor: 5_000 },
            ],
          },
        },
      });

    await postCaptureLedger();
    await expect(postCaptureLedger()).rejects.toThrow();
  });
});

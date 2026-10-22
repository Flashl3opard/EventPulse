import type { Express } from "express";
import type { PrismaClient } from "@eventpulse/database";
import { toDbEventType } from "@eventpulse/database";
import { paymentEventEnvelopeSchema, PAYMENT_EVENTS_TOPIC } from "@eventpulse/shared";
import { ApiError } from "../lib/errors.js";
import { mapPrismaError } from "../lib/prisma-errors.js";

// Development-only endpoint: no auth, not meant for public exposure.
//
// Scope of this handler: durably accept a well-formed event and hand it off
// to the outbox. It deliberately does NOT enforce the payment state machine
// (INITIATED -> AUTHORIZED -> ...): that requires the payment's true current
// state at the moment of processing, which is a consumer-side concern
// (Milestone 6) operating on Kafka delivery order, not HTTP request order.
// What it DOES enforce is referential integrity of the HTTP request itself:
// `payment.initiated` must not target a payment id that already exists, and
// every other event type must target one that does.
export function registerPaymentEventsRoute(app: Express, prisma: PrismaClient): void {
  app.post("/api/v1/payment-events", async (req, res) => {
    const parsed = paymentEventEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "INVALID_EVENT",
        "The event payload failed validation.",
        parsed.error.issues,
      );
    }
    const envelope = parsed.data;

    try {
      // API-level idempotency: replaying the same eventId (e.g. a client
      // retry after a dropped response) returns the original acceptance
      // rather than erroring or double-accepting. This is distinct from
      // the consumer's inbox dedup, which guards business-effect
      // application. Reads here can fail the same way writes below can
      // (e.g. the database being unreachable), so this is inside the same
      // try/catch that maps those failures to a clean error response.
      const existing = await prisma.paymentEvent.findUnique({
        where: { eventId: envelope.eventId },
      });
      if (existing) {
        res.status(200).json({
          eventId: existing.eventId,
          paymentId: existing.paymentId,
          status: "ALREADY_ACCEPTED",
        });
        return;
      }

      const created = await prisma.$transaction(async (tx) => {
        const paymentId = envelope.paymentId;

        if (envelope.eventType === "payment.initiated") {
          const alreadyExists = await tx.payment.findUnique({ where: { id: paymentId } });
          if (alreadyExists) {
            throw new ApiError(
              409,
              "PAYMENT_ALREADY_EXISTS",
              `Payment ${paymentId} has already been initiated.`,
            );
          }

          await tx.merchant.upsert({
            where: { id: envelope.merchantId },
            create: { id: envelope.merchantId, name: `Merchant ${envelope.merchantId}` },
            update: {},
          });

          await tx.payment.create({
            data: {
              id: paymentId,
              merchantId: envelope.merchantId,
              currency: envelope.payload.currency,
              requestedAmountMinor: envelope.payload.amountMinor,
            },
          });
        } else {
          const payment = await tx.payment.findUnique({ where: { id: paymentId } });
          if (!payment) {
            throw new ApiError(
              404,
              "PAYMENT_NOT_FOUND",
              `Payment ${paymentId} has not been initiated yet.`,
            );
          }
          if (payment.merchantId !== envelope.merchantId) {
            throw new ApiError(
              409,
              "MERCHANT_MISMATCH",
              `Payment ${paymentId} belongs to a different merchant than the one in this event.`,
            );
          }
        }

        const event = await tx.paymentEvent.create({
          data: {
            eventId: envelope.eventId,
            merchantId: envelope.merchantId,
            paymentId,
            eventType: toDbEventType(envelope.eventType),
            schemaVersion: envelope.schemaVersion,
            occurredAt: new Date(envelope.occurredAt),
            payload: envelope.payload,
          },
        });

        await tx.outboxRecord.create({
          data: {
            paymentEventId: event.id,
            topic: PAYMENT_EVENTS_TOPIC,
            partitionKey: paymentId,
          },
        });

        return event;
      });

      res
        .status(202)
        .json({ eventId: created.eventId, paymentId: created.paymentId, status: "ACCEPTED" });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw mapPrismaError(err) ?? err;
    }
  });
}

import type { Express } from "express";
import { z } from "zod";
import type { PrismaClient } from "@eventpulse/database";
import { fromDbEventType } from "@eventpulse/database";
import { ApiError } from "../lib/errors.js";

const eventIdSchema = z.string().uuid();

// Development-only endpoint: no auth, not meant for public exposure.
export function registerEventsRoute(app: Express, prisma: PrismaClient): void {
  app.get("/api/v1/events/:eventId", async (req, res) => {
    const parsedId = eventIdSchema.safeParse(req.params.eventId);
    if (!parsedId.success) {
      throw new ApiError(
        400,
        "INVALID_EVENT_ID",
        `"${req.params.eventId}" is not a valid event id.`,
      );
    }

    const event = await prisma.paymentEvent.findUnique({
      where: { eventId: parsedId.data },
      include: { outboxRecord: true, inboxRecord: true },
    });
    if (!event) {
      throw new ApiError(404, "EVENT_NOT_FOUND", `Event ${parsedId.data} was not found.`);
    }

    res.status(200).json({
      eventId: event.eventId,
      eventType: fromDbEventType(event.eventType),
      merchantId: event.merchantId,
      paymentId: event.paymentId,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
      payload: event.payload,
      outbox: event.outboxRecord
        ? {
            status: event.outboxRecord.status,
            attempts: event.outboxRecord.attempts,
            publishedAt: event.outboxRecord.publishedAt,
          }
        : null,
      // No inbox row yet means the consumer (Milestone 6) hasn't processed
      // this event's Kafka delivery — reported as PENDING rather than null
      // so clients have one consistent status field to poll.
      processing: event.inboxRecord
        ? {
            status: event.inboxRecord.status,
            processedAt: event.inboxRecord.processedAt,
            note: event.inboxRecord.note,
          }
        : { status: "PENDING", processedAt: null, note: null },
    });
  });
}

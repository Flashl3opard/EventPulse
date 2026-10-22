import { z } from "zod";
import { CURRENT_EVENT_SCHEMA_VERSION } from "./types.js";

const currencySchema = z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO 4217 code");

const positiveMinorAmountSchema = z.number().int().positive();

const baseEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  schemaVersion: z.literal(CURRENT_EVENT_SCHEMA_VERSION),
  occurredAt: z.string().datetime({ offset: true }),
  merchantId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

export const paymentInitiatedPayloadSchema = z.object({
  amountMinor: positiveMinorAmountSchema,
  currency: currencySchema,
  description: z.string().max(500).optional(),
});

export const paymentAuthorizedPayloadSchema = z.object({
  authorizedAmountMinor: positiveMinorAmountSchema,
  authorizationCode: z.string().min(1).max(100),
});

export const paymentCapturedPayloadSchema = z.object({
  capturedAmountMinor: positiveMinorAmountSchema,
});

export const paymentFailedPayloadSchema = z.object({
  reason: z.string().min(1).max(500),
  failedStage: z.enum(["initiation", "authorization", "capture"]),
});

export const paymentRefundedPayloadSchema = z.object({
  refundAmountMinor: positiveMinorAmountSchema,
  reason: z.string().max(500).optional(),
});

export const paymentEventEnvelopeSchema = z.discriminatedUnion("eventType", [
  baseEnvelopeSchema.extend({
    eventType: z.literal("payment.initiated"),
    payload: paymentInitiatedPayloadSchema,
  }),
  baseEnvelopeSchema.extend({
    eventType: z.literal("payment.authorized"),
    payload: paymentAuthorizedPayloadSchema,
  }),
  baseEnvelopeSchema.extend({
    eventType: z.literal("payment.captured"),
    payload: paymentCapturedPayloadSchema,
  }),
  baseEnvelopeSchema.extend({
    eventType: z.literal("payment.failed"),
    payload: paymentFailedPayloadSchema,
  }),
  baseEnvelopeSchema.extend({
    eventType: z.literal("payment.refunded"),
    payload: paymentRefundedPayloadSchema,
  }),
]);

export type PaymentEventEnvelope = z.infer<typeof paymentEventEnvelopeSchema>;
export type PaymentInitiatedPayload = z.infer<typeof paymentInitiatedPayloadSchema>;
export type PaymentAuthorizedPayload = z.infer<typeof paymentAuthorizedPayloadSchema>;
export type PaymentCapturedPayload = z.infer<typeof paymentCapturedPayloadSchema>;
export type PaymentFailedPayload = z.infer<typeof paymentFailedPayloadSchema>;
export type PaymentRefundedPayload = z.infer<typeof paymentRefundedPayloadSchema>;

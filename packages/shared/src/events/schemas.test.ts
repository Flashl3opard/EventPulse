import { describe, expect, it } from "vitest";
import { paymentEventEnvelopeSchema } from "./schemas.js";

const baseFields = {
  eventId: "11111111-1111-1111-1111-111111111111",
  schemaVersion: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  merchantId: "22222222-2222-2222-2222-222222222222",
  paymentId: "33333333-3333-3333-3333-333333333333",
};

describe("paymentEventEnvelopeSchema", () => {
  it("accepts a valid payment.initiated event", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.initiated",
      payload: { amountMinor: 5000, currency: "USD" },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid payment.refunded event", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.refunded",
      payload: { refundAmountMinor: 1500, reason: "customer request" },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.unknown",
      payload: {},
    });

    expect(result.success).toBe(false);
  });

  it("rejects a payload mismatched with its event type", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.initiated",
      payload: { refundAmountMinor: 1500 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.initiated",
      payload: { amountMinor: 0, currency: "USD" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a currency code that is not 3 uppercase letters", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.initiated",
      payload: { amountMinor: 5000, currency: "usd" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID eventId", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventId: "not-a-uuid",
      eventType: "payment.initiated",
      payload: { amountMinor: 5000, currency: "USD" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported schema version", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      schemaVersion: 99,
      eventType: "payment.initiated",
      payload: { amountMinor: 5000, currency: "USD" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid failedStage on payment.failed", () => {
    const result = paymentEventEnvelopeSchema.safeParse({
      ...baseFields,
      eventType: "payment.failed",
      payload: { reason: "card declined", failedStage: "settlement" },
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { classifyPaymentTransition, resolveRefundAmount } from "./state-machine.js";

describe("classifyPaymentTransition", () => {
  it("accepts the full happy path in order", () => {
    expect(classifyPaymentTransition("payment.initiated", "NEW")).toEqual({
      kind: "VALID",
      nextStatus: "INITIATED",
    });
    expect(classifyPaymentTransition("payment.authorized", "INITIATED")).toEqual({
      kind: "VALID",
      nextStatus: "AUTHORIZED",
    });
    expect(classifyPaymentTransition("payment.captured", "AUTHORIZED")).toEqual({
      kind: "VALID",
      nextStatus: "CAPTURED",
    });
    expect(classifyPaymentTransition("payment.refunded", "CAPTURED")).toEqual({
      kind: "VALID",
      nextStatus: "CAPTURED",
    });
  });

  it("accepts payment.failed from either INITIATED or AUTHORIZED", () => {
    expect(classifyPaymentTransition("payment.failed", "INITIATED").kind).toBe("VALID");
    expect(classifyPaymentTransition("payment.failed", "AUTHORIZED").kind).toBe("VALID");
  });

  it("classifies an event whose prerequisite has not happened yet as out of order", () => {
    expect(classifyPaymentTransition("payment.captured", "NEW")).toEqual({
      kind: "ORPHANED_OUT_OF_ORDER",
      expectedPriorStatus: "AUTHORIZED",
    });
    expect(classifyPaymentTransition("payment.captured", "INITIATED")).toEqual({
      kind: "ORPHANED_OUT_OF_ORDER",
      expectedPriorStatus: "AUTHORIZED",
    });
    expect(classifyPaymentTransition("payment.authorized", "NEW")).toEqual({
      kind: "ORPHANED_OUT_OF_ORDER",
      expectedPriorStatus: "INITIATED",
    });
    expect(classifyPaymentTransition("payment.refunded", "AUTHORIZED")).toEqual({
      kind: "ORPHANED_OUT_OF_ORDER",
      expectedPriorStatus: "CAPTURED",
    });
  });

  it("rejects an event arriving for a payment that has already moved past it", () => {
    expect(classifyPaymentTransition("payment.authorized", "CAPTURED").kind).toBe(
      "REJECTED_INVALID_TRANSITION",
    );
    expect(classifyPaymentTransition("payment.captured", "FAILED").kind).toBe(
      "REJECTED_INVALID_TRANSITION",
    );
  });

  it("rejects an event targeting a terminal payment", () => {
    expect(classifyPaymentTransition("payment.authorized", "FAILED").kind).toBe(
      "REJECTED_INVALID_TRANSITION",
    );
    expect(classifyPaymentTransition("payment.refunded", "REFUNDED").kind).toBe(
      "REJECTED_INVALID_TRANSITION",
    );
  });

  it("rejects a duplicate payment.initiated for a payment id that already exists", () => {
    expect(classifyPaymentTransition("payment.initiated", "INITIATED").kind).toBe(
      "REJECTED_INVALID_TRANSITION",
    );
  });
});

describe("resolveRefundAmount", () => {
  it("keeps the payment CAPTURED for a partial refund", () => {
    expect(resolveRefundAmount(10_000, 0, 4_000)).toEqual({
      ok: true,
      nextStatus: "CAPTURED",
      newRefundedAmountMinor: 4_000,
    });
  });

  it("supports multiple partial refunds that accumulate", () => {
    expect(resolveRefundAmount(10_000, 4_000, 3_000)).toEqual({
      ok: true,
      nextStatus: "CAPTURED",
      newRefundedAmountMinor: 7_000,
    });
  });

  it("moves to REFUNDED once cumulative refunds exactly reach the captured amount", () => {
    expect(resolveRefundAmount(10_000, 7_000, 3_000)).toEqual({
      ok: true,
      nextStatus: "REFUNDED",
      newRefundedAmountMinor: 10_000,
    });
  });

  it("rejects a refund that would exceed the captured amount", () => {
    expect(resolveRefundAmount(10_000, 7_000, 4_000)).toEqual({
      ok: false,
      reason: "REFUND_EXCEEDS_CAPTURED_AMOUNT",
    });
  });

  it("rejects any refund once the captured amount is already fully refunded", () => {
    expect(resolveRefundAmount(10_000, 10_000, 1)).toEqual({
      ok: false,
      reason: "REFUND_EXCEEDS_CAPTURED_AMOUNT",
    });
  });
});

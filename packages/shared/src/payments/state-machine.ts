import type { PaymentEventType } from "../events/types.js";
import type { PaymentLifecycleState, PaymentStatus } from "./types.js";

/**
 * Distinguishes three outcomes for an incoming event given the payment's
 * current lifecycle state:
 *
 * - VALID: the event's prerequisite state has been reached; apply it.
 * - ORPHANED_OUT_OF_ORDER: the prerequisite state has NOT been reached yet
 *   (e.g. `payment.captured` arrives before `payment.authorized` was
 *   processed). The missing event may still arrive, so this is held for
 *   investigation/retry rather than rejected outright.
 * - REJECTED_INVALID_TRANSITION: the payment has already moved past the
 *   point where this event would apply, or is in a terminal state. Waiting
 *   will not fix this; it is a conflicting or stale event.
 */
export type TransitionClassification =
  | { kind: "VALID"; nextStatus: PaymentStatus }
  | { kind: "ORPHANED_OUT_OF_ORDER"; expectedPriorStatus: PaymentStatus }
  | { kind: "REJECTED_INVALID_TRANSITION"; reason: string };

function valid(nextStatus: PaymentStatus): TransitionClassification {
  return { kind: "VALID", nextStatus };
}

function outOfOrder(expectedPriorStatus: PaymentStatus): TransitionClassification {
  return { kind: "ORPHANED_OUT_OF_ORDER", expectedPriorStatus };
}

function invalid(reason: string): TransitionClassification {
  return { kind: "REJECTED_INVALID_TRANSITION", reason };
}

export function classifyPaymentTransition(
  eventType: PaymentEventType,
  currentState: PaymentLifecycleState,
): TransitionClassification {
  switch (eventType) {
    case "payment.initiated":
      return currentState === "NEW"
        ? valid("INITIATED")
        : invalid(`payment already exists with status ${currentState}`);

    case "payment.authorized":
      if (currentState === "INITIATED") return valid("AUTHORIZED");
      if (currentState === "NEW") return outOfOrder("INITIATED");
      return invalid(`cannot authorize a payment with status ${currentState}`);

    case "payment.captured":
      if (currentState === "AUTHORIZED") return valid("CAPTURED");
      if (currentState === "NEW" || currentState === "INITIATED") return outOfOrder("AUTHORIZED");
      return invalid(`cannot capture a payment with status ${currentState}`);

    case "payment.failed":
      if (currentState === "INITIATED" || currentState === "AUTHORIZED") return valid("FAILED");
      if (currentState === "NEW") return outOfOrder("INITIATED");
      return invalid(`cannot fail a payment with status ${currentState}`);

    case "payment.refunded":
      // Structural validity only. Whether a *specific* refund amount is
      // acceptable (it must not exceed what remains captured) is a separate
      // check — see resolveRefundAmount — because that depends on amounts,
      // not just the current status.
      if (currentState === "CAPTURED") return valid("CAPTURED");
      if (currentState === "NEW" || currentState === "INITIATED" || currentState === "AUTHORIZED") {
        return outOfOrder("CAPTURED");
      }
      return invalid(`cannot refund a payment with status ${currentState}`);
  }
}

export type RefundResolution =
  | { ok: true; nextStatus: PaymentStatus; newRefundedAmountMinor: number }
  | { ok: false; reason: "REFUND_EXCEEDS_CAPTURED_AMOUNT" };

/**
 * Supports multiple partial refunds: a payment stays CAPTURED while
 * cumulative refunds are below the captured amount, and only moves to
 * REFUNDED once cumulative refunds exactly reach it. Over-refunding is
 * rejected rather than clamped, so the caller can classify the event for
 * investigation instead of silently under-crediting the merchant.
 */
export function resolveRefundAmount(
  capturedAmountMinor: number,
  previouslyRefundedAmountMinor: number,
  refundAmountMinor: number,
): RefundResolution {
  const newRefundedAmountMinor = previouslyRefundedAmountMinor + refundAmountMinor;

  if (newRefundedAmountMinor > capturedAmountMinor) {
    return { ok: false, reason: "REFUND_EXCEEDS_CAPTURED_AMOUNT" };
  }

  return {
    ok: true,
    nextStatus: newRefundedAmountMinor === capturedAmountMinor ? "REFUNDED" : "CAPTURED",
    newRefundedAmountMinor,
  };
}

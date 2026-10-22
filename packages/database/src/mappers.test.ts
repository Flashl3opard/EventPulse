import { describe, expect, it } from "vitest";
import { PAYMENT_EVENT_TYPES } from "@eventpulse/shared";
import { fromDbEventType, toDbEventType } from "./mappers.js";

describe("event type mappers", () => {
  it("round-trips every wire event type through the DB enum", () => {
    for (const wireType of PAYMENT_EVENT_TYPES) {
      expect(fromDbEventType(toDbEventType(wireType))).toBe(wireType);
    }
  });

  it("maps each wire event type to its expected DB enum value", () => {
    expect(toDbEventType("payment.initiated")).toBe("PAYMENT_INITIATED");
    expect(toDbEventType("payment.authorized")).toBe("PAYMENT_AUTHORIZED");
    expect(toDbEventType("payment.captured")).toBe("PAYMENT_CAPTURED");
    expect(toDbEventType("payment.failed")).toBe("PAYMENT_FAILED");
    expect(toDbEventType("payment.refunded")).toBe("PAYMENT_REFUNDED");
  });
});

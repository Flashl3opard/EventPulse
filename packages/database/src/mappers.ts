import type { PaymentEventType as DbPaymentEventType } from "@prisma/client";
import type { PaymentEventType } from "@eventpulse/shared";

const WIRE_TO_DB_EVENT_TYPE: Record<PaymentEventType, DbPaymentEventType> = {
  "payment.initiated": "PAYMENT_INITIATED",
  "payment.authorized": "PAYMENT_AUTHORIZED",
  "payment.captured": "PAYMENT_CAPTURED",
  "payment.failed": "PAYMENT_FAILED",
  "payment.refunded": "PAYMENT_REFUNDED",
};

const DB_TO_WIRE_EVENT_TYPE: Record<DbPaymentEventType, PaymentEventType> = {
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_AUTHORIZED: "payment.authorized",
  PAYMENT_CAPTURED: "payment.captured",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
};

export function toDbEventType(eventType: PaymentEventType): DbPaymentEventType {
  return WIRE_TO_DB_EVENT_TYPE[eventType];
}

export function fromDbEventType(dbEventType: DbPaymentEventType): PaymentEventType {
  return DB_TO_WIRE_EVENT_TYPE[dbEventType];
}

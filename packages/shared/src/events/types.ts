export const PAYMENT_EVENT_TYPES = [
  "payment.initiated",
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "payment.refunded",
] as const;

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

export const CURRENT_EVENT_SCHEMA_VERSION = 1;

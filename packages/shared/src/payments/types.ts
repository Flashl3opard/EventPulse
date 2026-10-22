export const PAYMENT_STATUSES = [
  "INITIATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * "NEW" is not a stored status — it represents a payment id that does not
 * yet have a row in the database, used only when classifying a transition.
 */
export type PaymentLifecycleState = PaymentStatus | "NEW";

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = ["FAILED", "REFUNDED"];

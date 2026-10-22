// Single topic, partitioned by paymentId (see partitionKey usage at the
// call site) so events for the same payment are routed to the same
// partition and processed in order relative to each other. This does NOT
// guarantee ordering across different payments/partitions — the consumer
// must still handle out-of-order delivery (see payments/state-machine.ts).
export const PAYMENT_EVENTS_TOPIC = "eventpulse.payment-events.v1";

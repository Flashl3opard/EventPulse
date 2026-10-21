import { CONFIG_PACKAGE_NAME } from "@eventpulse/config";
import { SHARED_PACKAGE_NAME } from "@eventpulse/shared";

// The KafkaJS consumer, inbox dedup, and ledger processing are added in Milestone 6.
export const SERVICE_NAME = "@eventpulse/event-consumer";

export function describeWorkspaceWiring(): string {
  return `${SERVICE_NAME} resolves ${SHARED_PACKAGE_NAME} and ${CONFIG_PACKAGE_NAME}`;
}

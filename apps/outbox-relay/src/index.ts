import { CONFIG_PACKAGE_NAME } from "@eventpulse/config";
import { SHARED_PACKAGE_NAME } from "@eventpulse/shared";

// Outbox polling/claiming and Kafka publishing are added in Milestone 5.
export const SERVICE_NAME = "@eventpulse/outbox-relay";

export function describeWorkspaceWiring(): string {
  return `${SERVICE_NAME} resolves ${SHARED_PACKAGE_NAME} and ${CONFIG_PACKAGE_NAME}`;
}

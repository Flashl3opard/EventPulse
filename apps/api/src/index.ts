import { CONFIG_PACKAGE_NAME } from "@eventpulse/config";
import { SHARED_PACKAGE_NAME } from "@eventpulse/shared";

// The Express app and routes are added in Milestone 4.
export const SERVICE_NAME = "@eventpulse/api";

export function describeWorkspaceWiring(): string {
  return `${SERVICE_NAME} resolves ${SHARED_PACKAGE_NAME} and ${CONFIG_PACKAGE_NAME}`;
}

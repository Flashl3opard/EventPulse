import { describe, expect, it } from "vitest";
import { describeWorkspaceWiring, SERVICE_NAME } from "./index.js";

describe("@eventpulse/outbox-relay scaffold", () => {
  it("resolves its workspace dependencies", () => {
    expect(SERVICE_NAME).toBe("@eventpulse/outbox-relay");
    expect(describeWorkspaceWiring()).toContain("@eventpulse/shared");
    expect(describeWorkspaceWiring()).toContain("@eventpulse/config");
  });
});

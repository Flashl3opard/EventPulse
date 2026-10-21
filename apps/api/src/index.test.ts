import { describe, expect, it } from "vitest";
import { describeWorkspaceWiring, SERVICE_NAME } from "./index.js";

describe("@eventpulse/api scaffold", () => {
  it("resolves its workspace dependencies", () => {
    expect(SERVICE_NAME).toBe("@eventpulse/api");
    expect(describeWorkspaceWiring()).toContain("@eventpulse/shared");
    expect(describeWorkspaceWiring()).toContain("@eventpulse/config");
  });
});

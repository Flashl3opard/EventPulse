import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE_NAME } from "./index.js";

describe("@eventpulse/shared scaffold", () => {
  it("exposes its package name", () => {
    expect(SHARED_PACKAGE_NAME).toBe("@eventpulse/shared");
  });
});

import { describe, expect, it } from "vitest";
import { CONFIG_PACKAGE_NAME } from "./index.js";

describe("@eventpulse/config scaffold", () => {
  it("exposes its package name", () => {
    expect(CONFIG_PACKAGE_NAME).toBe("@eventpulse/config");
  });
});

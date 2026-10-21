import { describe, expect, it } from "vitest";
import { DATABASE_PACKAGE_NAME } from "./index.js";

describe("@eventpulse/database scaffold", () => {
  it("exposes its package name", () => {
    expect(DATABASE_PACKAGE_NAME).toBe("@eventpulse/database");
  });
});

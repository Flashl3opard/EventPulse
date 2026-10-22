import { describe, expect, it } from "vitest";
import { loadConfig } from "./index.js";

const validEnv = {
  NODE_ENV: "test",
  PORT: "4000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("loadConfig", () => {
  it("parses a valid environment", () => {
    expect(loadConfig(validEnv)).toEqual({
      nodeEnv: "test",
      port: 4000,
      databaseUrl: validEnv.DATABASE_URL,
    });
  });

  it("defaults NODE_ENV and PORT when absent", () => {
    const { DATABASE_URL } = validEnv;
    expect(loadConfig({ DATABASE_URL })).toEqual({
      nodeEnv: "development",
      port: 3000,
      databaseUrl: DATABASE_URL,
    });
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("throws when PORT is not a positive integer", () => {
    expect(() => loadConfig({ ...validEnv, PORT: "-1" })).toThrow();
  });

  it("throws when NODE_ENV is not one of the known values", () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: "staging" })).toThrow();
  });
});

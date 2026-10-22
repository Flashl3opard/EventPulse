import { describe, expect, it } from "vitest";
import { assertLedgerEntriesBalance, buildCaptureEntries, buildRefundEntries } from "./types.js";

describe("buildCaptureEntries", () => {
  it("debits platform cash and credits merchant payable for the same amount", () => {
    const entries = buildCaptureEntries(5_000);
    expect(entries).toEqual([
      { account: "PLATFORM_CASH", direction: "DEBIT", amountMinor: 5_000 },
      { account: "MERCHANT_PAYABLE", direction: "CREDIT", amountMinor: 5_000 },
    ]);
    expect(() => assertLedgerEntriesBalance(entries)).not.toThrow();
  });
});

describe("buildRefundEntries", () => {
  it("reverses the capture direction for the refunded amount", () => {
    const entries = buildRefundEntries(2_000);
    expect(entries).toEqual([
      { account: "MERCHANT_PAYABLE", direction: "DEBIT", amountMinor: 2_000 },
      { account: "PLATFORM_CASH", direction: "CREDIT", amountMinor: 2_000 },
    ]);
    expect(() => assertLedgerEntriesBalance(entries)).not.toThrow();
  });
});

describe("assertLedgerEntriesBalance", () => {
  it("throws when debits and credits do not match", () => {
    expect(() =>
      assertLedgerEntriesBalance([
        { account: "PLATFORM_CASH", direction: "DEBIT", amountMinor: 100 },
        { account: "MERCHANT_PAYABLE", direction: "CREDIT", amountMinor: 99 },
      ]),
    ).toThrow(/do not balance/);
  });
});

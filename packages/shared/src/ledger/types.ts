export const LEDGER_ACCOUNTS = ["PLATFORM_CASH", "MERCHANT_PAYABLE"] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

export const LEDGER_DIRECTIONS = ["DEBIT", "CREDIT"] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_TRANSACTION_TYPES = ["CAPTURE", "REFUND"] as const;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];

export interface LedgerEntryInput {
  account: LedgerAccount;
  direction: LedgerDirection;
  amountMinor: number;
}

/**
 * Simplified two-account simulated ledger: PLATFORM_CASH represents funds
 * EventPulse holds on behalf of merchants; MERCHANT_PAYABLE represents what
 * is owed to the merchant. This models double-entry bookkeeping for
 * demonstration purposes only — it is not a production settlement ledger
 * (no clearing, fees, or real money movement).
 */
export function buildCaptureEntries(amountMinor: number): LedgerEntryInput[] {
  return [
    { account: "PLATFORM_CASH", direction: "DEBIT", amountMinor },
    { account: "MERCHANT_PAYABLE", direction: "CREDIT", amountMinor },
  ];
}

export function buildRefundEntries(amountMinor: number): LedgerEntryInput[] {
  return [
    { account: "MERCHANT_PAYABLE", direction: "DEBIT", amountMinor },
    { account: "PLATFORM_CASH", direction: "CREDIT", amountMinor },
  ];
}

export function assertLedgerEntriesBalance(entries: readonly LedgerEntryInput[]): void {
  const totalDebits = entries
    .filter((entry) => entry.direction === "DEBIT")
    .reduce((sum, entry) => sum + entry.amountMinor, 0);
  const totalCredits = entries
    .filter((entry) => entry.direction === "CREDIT")
    .reduce((sum, entry) => sum + entry.amountMinor, 0);

  if (totalDebits !== totalCredits) {
    throw new Error(`Ledger entries do not balance: debits=${totalDebits} credits=${totalCredits}`);
  }
}

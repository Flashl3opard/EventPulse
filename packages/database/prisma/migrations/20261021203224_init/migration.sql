-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('PAYMENT_INITIATED', 'PAYMENT_AUTHORIZED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventProcessingStatus" AS ENUM ('PENDING', 'APPLIED', 'DUPLICATE_IGNORED', 'REJECTED_INVALID_TRANSITION', 'ORPHANED_OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('CAPTURE', 'REFUND');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('PLATFORM_CASH', 'MERCHANT_PAYABLE');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "currency" VARCHAR(3) NOT NULL,
    "requestedAmountMinor" INTEGER NOT NULL,
    "authorizedAmountMinor" INTEGER,
    "capturedAmountMinor" INTEGER,
    "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "eventType" "PaymentEventType" NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_records" (
    "id" UUID NOT NULL,
    "paymentEventId" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_records" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "paymentEventId" UUID NOT NULL,
    "status" "PaymentEventProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "sourceEventId" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "ledgerTransactionId" UUID NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_merchantId_idx" ON "payments"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_eventId_key" ON "payment_events"("eventId");

-- CreateIndex
CREATE INDEX "payment_events_paymentId_idx" ON "payment_events"("paymentId");

-- CreateIndex
CREATE INDEX "payment_events_merchantId_idx" ON "payment_events"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_records_paymentEventId_key" ON "outbox_records"("paymentEventId");

-- CreateIndex
CREATE INDEX "outbox_records_status_createdAt_idx" ON "outbox_records"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_records_eventId_key" ON "inbox_records"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_records_paymentEventId_key" ON "inbox_records"("paymentEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_sourceEventId_key" ON "ledger_transactions"("sourceEventId");

-- CreateIndex
CREATE INDEX "ledger_transactions_paymentId_idx" ON "ledger_transactions"("paymentId");

-- CreateIndex
CREATE INDEX "ledger_entries_ledgerTransactionId_idx" ON "ledger_entries"("ledgerTransactionId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_records" ADD CONSTRAINT "outbox_records_paymentEventId_fkey" FOREIGN KEY ("paymentEventId") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_records" ADD CONSTRAINT "inbox_records_paymentEventId_fkey" FOREIGN KEY ("paymentEventId") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "payment_events"("eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written CHECK constraints: the Prisma schema language has no way to
-- express these, so they are added directly to this migration. They enforce
-- amount invariants at the database level as a defense-in-depth backstop
-- behind the application-level checks in packages/shared (state-machine.ts).

-- A payment's requested amount must be a positive number of minor units.
ALTER TABLE "payments" ADD CONSTRAINT "payments_requested_amount_positive"
  CHECK ("requestedAmountMinor" > 0);

-- An authorization can never exceed what was requested.
ALTER TABLE "payments" ADD CONSTRAINT "payments_authorized_amount_valid"
  CHECK ("authorizedAmountMinor" IS NULL OR
         ("authorizedAmountMinor" > 0 AND "authorizedAmountMinor" <= "requestedAmountMinor"));

-- A capture can never exceed what was authorized, and cannot exist without
-- an authorization.
ALTER TABLE "payments" ADD CONSTRAINT "payments_captured_amount_valid"
  CHECK ("capturedAmountMinor" IS NULL OR
         ("authorizedAmountMinor" IS NOT NULL AND
          "capturedAmountMinor" > 0 AND
          "capturedAmountMinor" <= "authorizedAmountMinor"));

-- Cumulative refunds (across any number of partial refunds) can never
-- exceed what was captured, and nothing can be refunded before a capture.
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_amount_valid"
  CHECK ("refundedAmountMinor" >= 0 AND
         "refundedAmountMinor" <= COALESCE("capturedAmountMinor", 0));

-- A ledger entry amount is always a positive number of minor units; the
-- DEBIT/CREDIT direction column carries the sign, not the amount.
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive"
  CHECK ("amountMinor" > 0);


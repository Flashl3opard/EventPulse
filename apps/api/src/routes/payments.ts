import type { Express } from "express";
import { z } from "zod";
import type { PrismaClient } from "@eventpulse/database";
import { ApiError } from "../lib/errors.js";

const paymentIdSchema = z.string().uuid();

// Development-only endpoint: no auth, not meant for public exposure.
export function registerPaymentsRoute(app: Express, prisma: PrismaClient): void {
  app.get("/api/v1/payments/:paymentId", async (req, res) => {
    const parsedId = paymentIdSchema.safeParse(req.params.paymentId);
    if (!parsedId.success) {
      throw new ApiError(
        400,
        "INVALID_PAYMENT_ID",
        `"${req.params.paymentId}" is not a valid payment id.`,
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsedId.data },
      include: { ledgerTransactions: { include: { entries: true } } },
    });
    if (!payment) {
      throw new ApiError(404, "PAYMENT_NOT_FOUND", `Payment ${parsedId.data} was not found.`);
    }

    res.status(200).json({
      paymentId: payment.id,
      merchantId: payment.merchantId,
      status: payment.status,
      currency: payment.currency,
      requestedAmountMinor: payment.requestedAmountMinor,
      authorizedAmountMinor: payment.authorizedAmountMinor,
      capturedAmountMinor: payment.capturedAmountMinor,
      refundedAmountMinor: payment.refundedAmountMinor,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      ledger: payment.ledgerTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        currency: transaction.currency,
        createdAt: transaction.createdAt,
        entries: transaction.entries.map((entry) => ({
          account: entry.account,
          direction: entry.direction,
          amountMinor: entry.amountMinor,
        })),
      })),
    });
  });
}

import "server-only";

import { Prisma, type MockPayment } from "@/generated/prisma/client";
import { db } from "@/platform/db";

import { PaymentsError, type PaymentsClient, type RefundStatus } from "./types";

/** Payment ids that make the mock misbehave, for exercising failure paths. */
export const MOCK_PAYMENT_IDS = {
  decline: "pay_mock_decline",
  hang: "pay_mock_hang",
} as const;

const IN_FLIGHT_POLL_MS = 20;

const STATUSES: Record<MockPayment["status"], RefundStatus> = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
};

/**
 * In-app stand-in for the payments provider, backed by the mock_payments
 * table. Each idempotency key has one row: PENDING while a refund is in
 * flight, then SUCCEEDED or FAILED. A failed refund can be retried.
 */
export function createMockPaymentsClient(): PaymentsClient {
  /** Claims the key for a new attempt, or returns the refund that already went through. */
  async function claim(
    data: Prisma.MockPaymentCreateInput,
  ): Promise<{ payment: MockPayment; replayed: boolean }> {
    for (;;) {
      try {
        return {
          payment: await db.mockPayment.create({ data }),
          replayed: false,
        };
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
      }
      const existing = await db.mockPayment.findUniqueOrThrow({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing.status === "SUCCEEDED") {
        return { payment: existing, replayed: true };
      }
      if (existing.status === "FAILED") {
        const { count } = await db.mockPayment.updateMany({
          where: { id: existing.id, status: "FAILED" },
          data: { ...data, status: "PENDING" },
        });
        if (count > 0) {
          return {
            payment: { ...existing, status: "PENDING" },
            replayed: false,
          };
        }
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, IN_FLIGHT_POLL_MS));
    }
  }

  return {
    async refund({ idempotencyKey, paymentId, amountMinor, currency }) {
      if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        throw new PaymentsError("Refund amount must be a positive integer");
      }
      const { payment, replayed } = await claim({
        idempotencyKey,
        kind: "refund",
        paymentId,
        amountMinor,
        currency,
      });
      if (replayed) return { refundId: payment.id, replayed };

      if (paymentId === MOCK_PAYMENT_IDS.hang) {
        await new Promise(() => {});
      }
      const declined = paymentId === MOCK_PAYMENT_IDS.decline;
      await db.mockPayment.update({
        where: { id: payment.id },
        data: { status: declined ? "FAILED" : "SUCCEEDED" },
      });
      if (declined) {
        throw new PaymentsError(`Refund declined for ${paymentId}`);
      }
      return { refundId: payment.id, replayed: false };
    },
    async findRefund(idempotencyKey) {
      const payment = await db.mockPayment.findUnique({
        where: { idempotencyKey },
      });
      return payment
        ? { refundId: payment.id, status: STATUSES[payment.status] }
        : null;
    },
  };
}

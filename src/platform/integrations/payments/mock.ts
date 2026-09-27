import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/platform/db";

import { PaymentsError, type PaymentsClient } from "./types";

/** Payment ids that make the mock misbehave, for exercising failure paths. */
export const MOCK_PAYMENT_IDS = {
  decline: "pay_mock_decline",
  hang: "pay_mock_hang",
} as const;

/** In-app stand-in for the payments provider, backed by the mock_payments table. */
export function createMockPaymentsClient(): PaymentsClient {
  return {
    async refund({ idempotencyKey, paymentId, amountMinor, currency }) {
      const existing = await db.mockPayment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return { refundId: existing.id, replayed: true };

      if (paymentId === MOCK_PAYMENT_IDS.decline) {
        throw new PaymentsError(`Refund declined for ${paymentId}`);
      }
      if (paymentId === MOCK_PAYMENT_IDS.hang) {
        await new Promise(() => {});
      }
      if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        throw new PaymentsError("Refund amount must be a positive integer");
      }

      try {
        const created = await db.mockPayment.create({
          data: {
            idempotencyKey,
            kind: "refund",
            paymentId,
            amountMinor,
            currency,
          },
        });
        return { refundId: created.id, replayed: false };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const winner = await db.mockPayment.findUniqueOrThrow({
            where: { idempotencyKey },
          });
          return { refundId: winner.id, replayed: true };
        }
        throw error;
      }
    },
  };
}

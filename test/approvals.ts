import { defineApprovalType } from "@/platform/approvals/types";
import { createApprovalRegistry } from "@/platform/approvals/registry";

export type TestRefundPayload = {
  paymentId: string;
  amountMinor: number;
  currency: string;
};

/** Test-only approval type: a refund paid through the payments integration. */
export const testRefundType = defineApprovalType<TestRefundPayload>({
  key: "test.refund",
  label: "Test refund",
  requestPermission: "refunds.request",
  decidePermission: "refunds.approve",
  parse(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload must be an object");
    }
    const { paymentId, amountMinor, currency } = input as Record<
      string,
      unknown
    >;
    if (typeof paymentId !== "string" || !paymentId) {
      throw new Error("paymentId is required");
    }
    if (
      typeof amountMinor !== "number" ||
      !Number.isInteger(amountMinor) ||
      amountMinor <= 0
    ) {
      throw new Error("amountMinor must be a positive integer");
    }
    if (typeof currency !== "string" || currency.length !== 3) {
      throw new Error("currency must be a 3-letter code");
    }
    return { paymentId, amountMinor, currency };
  },
  describe: (p) =>
    `Refund ${(p.amountMinor / 100).toFixed(2)} ${p.currency} on ${p.paymentId}`,
  entity: (p) => ({ type: "Payment", id: p.paymentId }),
  async execute({ payload, idempotencyKey, integrations }) {
    await integrations.payments.refund({ idempotencyKey, ...payload });
  },
  async checkOutcome({ idempotencyKey, integrations }) {
    return (await integrations.payments.findRefund(idempotencyKey))
      ? "completed"
      : "failed";
  },
});

export const testRegistry = createApprovalRegistry([testRefundType]);

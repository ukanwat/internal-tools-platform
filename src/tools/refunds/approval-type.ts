import { db } from "@/platform/db";
import { defineApprovalType } from "@/platform/approvals/types";

import { formatMoney } from "./money";

export const REFUND_APPROVAL_TYPE = "refunds.issue";

export type RefundApprovalPayload = {
  refundId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
};

/** A refund above the approval threshold, paid once finance approves it. */
export const refundApprovalType = defineApprovalType<RefundApprovalPayload>({
  key: REFUND_APPROVAL_TYPE,
  label: "Refund",
  requestPermission: "refunds.request",
  decidePermission: "refunds.approve",
  parse(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload must be an object");
    }
    const { refundId, orderNumber, amountMinor, currency } = input as Record<
      string,
      unknown
    >;
    if (typeof refundId !== "string" || !refundId) {
      throw new Error("refundId is required");
    }
    if (typeof orderNumber !== "string" || !orderNumber) {
      throw new Error("orderNumber is required");
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
    return { refundId, orderNumber, amountMinor, currency };
  },
  describe: (p) =>
    `Refund ${formatMoney(p.amountMinor, p.currency)} on order ${p.orderNumber}`,
  entity: (p) => ({ type: "Refund", id: p.refundId }),
  async execute({ request, payload, idempotencyKey, integrations }) {
    const refund = await db.refund.findUniqueOrThrow({
      where: { id: payload.refundId },
      include: { order: true },
    });
    if (refund.approvalRequestId !== request.id) {
      throw new Error("Refund is not linked to this approval request");
    }
    await integrations.payments.refund({
      idempotencyKey,
      paymentId: refund.order.paymentId,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
    });
  },
  async checkOutcome({ idempotencyKey, integrations }) {
    const refund = await integrations.payments.findRefund(idempotencyKey);
    if (!refund || refund.status === "failed") return "failed";
    return refund.status === "succeeded" ? "completed" : null;
  },
});

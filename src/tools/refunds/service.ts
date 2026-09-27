import "server-only";

import type { Order, Prisma, Refund } from "@/generated/prisma/client";
import type { RefundStatus } from "@/generated/prisma/enums";
import {
  createApprovalRequest,
  type ApprovalDeps,
} from "@/platform/approvals/service";
import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import {
  approvalProcessingTimeoutMs,
  refundApprovalThresholdMinor,
} from "@/platform/config";
import { db } from "@/platform/db";
import { getIntegrations, type Integrations } from "@/platform/integrations";
import { authorize } from "@/platform/permissions/guard";
import { TimeoutError, withTimeout } from "@/platform/timeout";

import { REFUND_APPROVAL_TYPE } from "./approval-type";
import { formatMoney } from "./money";
import { refundState, releasesAmount } from "./status";

export type RefundDeps = {
  integrations?: Integrations;
  now?: () => Date;
  /** Refunds above this (in minor units) need approval. */
  approvalThresholdMinor?: number;
  processingTimeoutMs?: number;
  approvals?: ApprovalDeps;
};

function resolveDeps(deps: RefundDeps) {
  return {
    integrations: deps.integrations ?? getIntegrations(),
    now: deps.now ?? (() => new Date()),
    approvalThresholdMinor:
      deps.approvalThresholdMinor ?? refundApprovalThresholdMinor(),
    processingTimeoutMs:
      deps.processingTimeoutMs ?? approvalProcessingTimeoutMs(),
    approvals: deps.approvals ?? {},
  };
}

/** The threshold is set in US dollars; refunds in any other currency always need approval. */
const THRESHOLD_CURRENCY = "USD";

export function needsApproval(
  amountMinor: number,
  currency: string,
  thresholdMinor: number,
): boolean {
  return currency !== THRESHOLD_CURRENCY || amountMinor > thresholdMinor;
}

export type RequestRefundResult =
  | {
      ok: true;
      refund: Refund;
      outcome: "paid" | "failed" | "processing" | "awaiting_approval";
    }
  | { ok: false; error: string };

/** Shown to people; the provider's own error goes to the audit log only. */
export const PAYMENT_FAILED_MESSAGE =
  "The payments provider didn't accept this refund. Nothing was paid.";

const auditEntity = (id: string) => ({ type: "Refund", id });

function snapshot(refund: Refund) {
  return {
    orderId: refund.orderId,
    amountMinor: refund.amountMinor,
    currency: refund.currency,
    status: refund.status,
    approvalRequestId: refund.approvalRequestId,
    paidAt: refund.paidAt,
    lastError: refund.lastError,
  };
}

class RefundBlocked extends Error {}

/** Minor units still refundable, counting refunds that are paid or on their way. */
export async function remainingRefundableMinor(
  order: Pick<Order, "id" | "amountMinor">,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<number> {
  const refunds = await client.refund.findMany({
    where: { orderId: order.id },
    select: { amountMinor: true, status: true, approvalRequestId: true },
  });
  const approvalIds = refunds.flatMap((r) =>
    r.approvalRequestId ? [r.approvalRequestId] : [],
  );
  const approvals = new Map(
    (
      await client.approvalRequest.findMany({
        where: { id: { in: approvalIds } },
        select: { id: true, status: true },
      })
    ).map((a) => [a.id, a.status]),
  );
  const committed = refunds
    .filter(
      (r) =>
        !releasesAmount(
          refundState(
            r.status,
            r.approvalRequestId
              ? (approvals.get(r.approvalRequestId) ?? null)
              : null,
          ),
        ),
    )
    .reduce((sum, r) => sum + r.amountMinor, 0);
  return Math.max(order.amountMinor - committed, 0);
}

/**
 * Records a refund on an order. At or under the approval threshold it is paid
 * straight away; above it, it waits for finance on /approvals.
 */
export async function requestRefund(
  actor: CurrentUser,
  input: { orderId: string; amountMinor: number; reason: string },
  deps: RefundDeps = {},
): Promise<RequestRefundResult> {
  const resolved = resolveDeps(deps);
  const orderEntity = { type: "Order", id: input.orderId };
  const auth = await authorize(actor, "refunds.request", orderEntity);
  if (!auth.ok) return { ok: false, error: "You cannot request refunds" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required" };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, error: "Enter an amount greater than zero" };
  }

  let created: { refund: Refund; order: Order; approval: boolean };
  try {
    created = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new RefundBlocked("Order not found");

      const remaining = await remainingRefundableMinor(order, tx);
      if (input.amountMinor > remaining) {
        throw new RefundBlocked(
          remaining === 0
            ? "This order has already been fully refunded"
            : `Only ${formatMoney(remaining, order.currency)} is left to refund on this order`,
        );
      }

      const approval = needsApproval(
        input.amountMinor,
        order.currency,
        resolved.approvalThresholdMinor,
      );
      let refund = await tx.refund.create({
        data: {
          orderId: order.id,
          amountMinor: input.amountMinor,
          currency: order.currency,
          reason,
          requestedById: actor.id,
          status: approval ? null : "PROCESSING",
        },
      });

      if (approval) {
        const request = await createApprovalRequest(
          actor,
          {
            type: REFUND_APPROVAL_TYPE,
            payload: {
              refundId: refund.id,
              orderNumber: order.number,
              amountMinor: refund.amountMinor,
              currency: refund.currency,
            },
            reason,
          },
          resolved.approvals,
          tx,
        );
        if (!request.ok) throw new RefundBlocked(request.error);
        refund = await tx.refund.update({
          where: { id: refund.id },
          data: { approvalRequestId: request.request.id },
        });
      }

      await recordAudit(
        {
          actor,
          action: "refunds.create",
          entity: auditEntity(refund.id),
          after: snapshot(refund),
          reason,
        },
        tx,
      );
      return { refund, order, approval };
    });
  } catch (error) {
    if (error instanceof RefundBlocked)
      return { ok: false, error: error.message };
    throw error;
  }

  if (created.approval) {
    return { ok: true, refund: created.refund, outcome: "awaiting_approval" };
  }
  return payRefund(actor, created.refund, created.order, resolved);
}

async function payRefund(
  actor: CurrentUser,
  refund: Refund,
  order: Order,
  deps: ReturnType<typeof resolveDeps>,
): Promise<RequestRefundResult> {
  const execution = Promise.resolve().then(() =>
    deps.integrations.payments.refund({
      idempotencyKey: refund.id,
      paymentId: order.paymentId,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
    }),
  );
  const settle = (result: Promise<unknown>) =>
    result.then(
      () => finish(refund.id, "PAID", actor, deps.now),
      (error: unknown) =>
        finish(refund.id, "FAILED", actor, deps.now, errorMessage(error)),
    );

  try {
    await withTimeout(
      execution,
      deps.processingTimeoutMs,
      "Payments provider timed out",
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      void settle(execution).catch((settleError) => console.error(settleError));
      return { ok: true, refund, outcome: "processing" };
    }
  }
  const finished = await settle(execution);
  const latest =
    finished ??
    (await db.refund.findUniqueOrThrow({ where: { id: refund.id } }));
  return {
    ok: true,
    refund: latest,
    outcome:
      latest.status === "PAID"
        ? "paid"
        : latest.status === "FAILED"
          ? "failed"
          : "processing",
  };
}

/** Moves a directly-paid refund out of PROCESSING and audits it. No-op if it already moved. */
async function finish(
  refundId: string,
  to: Exclude<RefundStatus, "PROCESSING">,
  actor: CurrentUser | null,
  now: () => Date,
  error?: string,
  reason?: string,
): Promise<Refund | null> {
  return db.$transaction(async (tx) => {
    const before = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
    });
    const { count } = await tx.refund.updateMany({
      where: { id: refundId, status: "PROCESSING" },
      data:
        to === "PAID"
          ? { status: "PAID", paidAt: now(), lastError: null }
          : { status: "FAILED", lastError: PAYMENT_FAILED_MESSAGE },
    });
    if (count === 0) return null;
    const after = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
    });
    await recordAudit(
      {
        actor,
        action: to === "PAID" ? "refunds.paid" : "refunds.payment_failed",
        outcome: to === "PAID" ? "SUCCESS" : "FAILURE",
        entity: auditEntity(refundId),
        before: snapshot(before),
        after: snapshot(after),
        reason: error ?? reason,
      },
      tx,
    );
    return after;
  });
}

/**
 * Settles directly-paid refunds stuck in PROCESSING past the timeout by asking
 * the payments provider what happened to them.
 */
export async function settleRefunds(
  deps: RefundDeps = {},
): Promise<{ settled: number }> {
  const { integrations, now, processingTimeoutMs } = resolveDeps(deps);
  const cutoff = new Date(now().getTime() - processingTimeoutMs);
  const stale = await db.refund.findMany({
    where: { status: "PROCESSING", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  let settled = 0;
  for (const { id } of stale) {
    let found: Awaited<ReturnType<Integrations["payments"]["findRefund"]>>;
    try {
      found = await integrations.payments.findRefund(id);
    } catch {
      continue;
    }
    if (found?.status === "pending") continue;
    const result =
      found?.status === "succeeded"
        ? await finish(
            id,
            "PAID",
            null,
            now,
            undefined,
            "Confirmed as paid by the payments provider",
          )
        : await finish(
            id,
            "FAILED",
            null,
            now,
            undefined,
            found
              ? "Payments provider reported the refund as failed"
              : "Payments provider never received the refund",
          );
    if (result) settled++;
  }
  return { settled };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

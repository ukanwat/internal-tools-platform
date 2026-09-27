import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { toSensitiveView } from "@/platform/sensitive/service";

import { REFUND_APPROVAL_TYPE } from "./approval-type";
import { remainingRefundableMinor } from "./service";
import { refundState, statusesFor, type RefundState } from "./status";

const PAGE_SIZE = 20;
export const ORDER_SEARCH_LIMIT = 20;

export async function searchOrders(query: string) {
  const q = query.trim();
  return db.order.findMany({
    where: q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { placedAt: "desc" },
    take: ORDER_SEARCH_LIMIT,
    select: {
      id: true,
      number: true,
      customerName: true,
      customerEmail: true,
      amountMinor: true,
      currency: true,
      placedAt: true,
    },
  });
}

type RefundRow = Prisma.RefundGetPayload<{
  include: {
    order: { select: { id: true; number: true; customerName: true } };
    requestedBy: { select: { name: true } };
  };
}>;

async function approvalStatuses(
  refunds: { approvalRequestId: string | null }[],
) {
  const ids = refunds.flatMap((r) =>
    r.approvalRequestId ? [r.approvalRequestId] : [],
  );
  const requests = await db.approvalRequest.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });
  return new Map<string, ApprovalStatus>(requests.map((r) => [r.id, r.status]));
}

async function withStates<T extends RefundRow>(refunds: T[]) {
  const statuses = await approvalStatuses(refunds);
  return refunds.map((refund) => ({
    ...refund,
    state: refundState(
      refund.status,
      refund.approvalRequestId
        ? (statuses.get(refund.approvalRequestId) ?? null)
        : null,
    ),
  }));
}

const refundInclude = {
  order: { select: { id: true, number: true, customerName: true } },
  requestedBy: { select: { name: true } },
} as const;

export type RefundListItem = Awaited<
  ReturnType<typeof withStates<RefundRow>>
>[number];

async function stateFilter(
  state: RefundState | undefined,
): Promise<Prisma.RefundWhereInput> {
  if (!state) return {};
  const { direct, approval } = statusesFor(state);
  const requests = approval.length
    ? await db.approvalRequest.findMany({
        where: { type: REFUND_APPROVAL_TYPE, status: { in: approval } },
        select: { id: true },
      })
    : [];
  return {
    OR: [
      { status: { in: direct } },
      { approvalRequestId: { in: requests.map((r) => r.id) } },
    ],
  };
}

export async function listRefunds(filters: {
  state?: RefundState;
  page?: number;
}) {
  const where = await stateFilter(filters.state);
  const total = await db.refund.count({ where });
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const page = Math.min(Math.max(filters.page ?? 1, 1), pageCount);
  const refunds = await db.refund.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: refundInclude,
  });
  return { refunds: await withStates(refunds), total, page, pageCount };
}

export async function getOrder(viewer: CurrentUser, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const refunds = await db.refund.findMany({
    where: { orderId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: refundInclude,
  });
  const { accountNumber, ...rest } = order;
  return {
    order: {
      ...rest,
      accountNumber: toSensitiveView(
        viewer,
        "accountNumber",
        { type: "Order", id: order.id },
        accountNumber,
      ),
    },
    refunds: await withStates(refunds),
    remainingMinor: await remainingRefundableMinor(order),
  };
}

export async function getRefund(viewer: CurrentUser, refundId: string) {
  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: {
      order: true,
      requestedBy: { select: { name: true, role: true } },
    },
  });
  if (!refund) return null;
  const approval = refund.approvalRequestId
    ? await db.approvalRequest.findUnique({
        where: { id: refund.approvalRequestId },
        select: {
          id: true,
          status: true,
          decisionReason: true,
          decidedAt: true,
          completedAt: true,
          lastError: true,
          decidedBy: { select: { name: true, role: true } },
        },
      })
    : null;
  const { accountNumber, ...order } = refund.order;
  return {
    refund: {
      ...refund,
      order: {
        ...order,
        accountNumber: toSensitiveView(
          viewer,
          "accountNumber",
          { type: "Order", id: order.id },
          accountNumber,
        ),
      },
      state: refundState(refund.status, approval?.status ?? null),
      paidAt: refund.paidAt ?? approval?.completedAt ?? null,
    },
    approval,
  };
}

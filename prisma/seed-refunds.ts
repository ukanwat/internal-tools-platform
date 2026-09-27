import type { Prisma, PrismaClient } from "../src/generated/prisma/client";

/** Fake orders for the Refunds tool. Account numbers are made up. */
const ORDERS = [
  {
    id: "order_1001",
    number: "ORD-1001",
    customerName: "Priya Shah",
    customerEmail: "priya.shah@example.com",
    amountMinor: 8_999,
    paymentId: "pay_seed_1001",
    accountNumber: "GB29NWBK60161331926819",
    placedAt: "2026-09-01T10:12:00Z",
  },
  {
    id: "order_1002",
    number: "ORD-1002",
    customerName: "Marcus Webb",
    customerEmail: "marcus.webb@example.com",
    amountMinor: 124_000,
    paymentId: "pay_seed_1002",
    accountNumber: "DE89370400440532013000",
    placedAt: "2026-09-04T15:40:00Z",
  },
  {
    id: "order_1003",
    number: "ORD-1003",
    customerName: "Elena García",
    customerEmail: "elena.garcia@example.com",
    amountMinor: 215_000,
    paymentId: "pay_seed_1003",
    accountNumber: "FR1420041010050500013M02606",
    placedAt: "2026-09-07T09:05:00Z",
  },
  {
    id: "order_1004",
    number: "ORD-1004",
    customerName: "Tom Okafor",
    customerEmail: "tom.okafor@example.com",
    amountMinor: 78_000,
    paymentId: "pay_seed_1004",
    accountNumber: "NL91ABNA0417164300",
    placedAt: "2026-09-10T18:22:00Z",
  },
  {
    id: "order_1005",
    number: "ORD-1005",
    customerName: "Hana Kim",
    customerEmail: "hana.kim@example.com",
    amountMinor: 4_500,
    paymentId: "pay_mock_decline",
    accountNumber: "ES9121000418450200051332",
    placedAt: "2026-09-12T12:00:00Z",
  },
  {
    id: "order_1006",
    number: "ORD-1006",
    customerName: "Liam Murphy",
    customerEmail: "liam.murphy@example.com",
    amountMinor: 31_000,
    paymentId: "pay_seed_1006",
    accountNumber: "IE29AIBK93115212345678",
    placedAt: "2026-09-15T08:30:00Z",
  },
  {
    id: "order_1007",
    number: "ORD-1007",
    customerName: "Sofia Rossi",
    customerEmail: "sofia.rossi@example.com",
    amountMinor: 64_900,
    paymentId: "pay_seed_1007",
    accountNumber: "IT60X0542811101000000123456",
    placedAt: "2026-09-18T14:15:00Z",
  },
  {
    id: "order_1008",
    number: "ORD-1008",
    customerName: "Noah Fischer",
    customerEmail: "noah.fischer@example.com",
    amountMinor: 2_499,
    paymentId: "pay_seed_1008",
    accountNumber: "AT611904300234573201",
    placedAt: "2026-09-20T11:45:00Z",
  },
  {
    id: "order_1009",
    number: "ORD-1009",
    customerName: "Ava Johnson",
    customerEmail: "ava.johnson@example.com",
    amountMinor: 12_000,
    paymentId: "pay_mock_decline",
    accountNumber: "BE68539007547034",
    placedAt: "2026-09-22T16:05:00Z",
  },
  {
    id: "order_1010",
    number: "ORD-1010",
    customerName: "Kenji Sato",
    customerEmail: "kenji.sato@example.com",
    amountMinor: 99_500,
    paymentId: "pay_seed_1010",
    accountNumber: "CH9300762011623852957",
    placedAt: "2026-09-24T19:50:00Z",
  },
] as const;

const SUPPORT = { id: "user_support", role: "SUPPORT" } as const;
const FINANCE = {
  id: "user_finance_approver",
  role: "FINANCE_APPROVER",
} as const;

const at = (iso: string) => new Date(iso);
const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

type SeedRefund = {
  id: string;
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
} & (
  | { kind: "direct"; status: "PAID" | "FAILED" }
  | {
      kind: "approval";
      approvalId: string;
      approval: "PENDING" | "COMPLETED" | "REJECTED";
      decisionReason?: string;
      decidedAt?: string;
    }
);

const REFUNDS: SeedRefund[] = [
  {
    id: "refund_seed_paid",
    kind: "direct",
    status: "PAID",
    orderId: "order_1001",
    orderNumber: "ORD-1001",
    amountMinor: 8_999,
    reason: "Item arrived damaged",
    createdAt: "2026-09-03T09:00:00Z",
  },
  {
    id: "refund_seed_pending",
    kind: "approval",
    approval: "PENDING",
    approvalId: "approval_seed_pending",
    orderId: "order_1002",
    orderNumber: "ORD-1002",
    amountMinor: 62_000,
    reason: "Half the order never shipped",
    createdAt: "2026-09-25T10:30:00Z",
  },
  {
    id: "refund_seed_approved",
    kind: "approval",
    approval: "COMPLETED",
    approvalId: "approval_seed_approved",
    decisionReason: "Confirmed cancellation with the warehouse",
    decidedAt: "2026-09-09T14:00:00Z",
    orderId: "order_1003",
    orderNumber: "ORD-1003",
    amountMinor: 215_000,
    reason: "Customer cancelled before dispatch",
    createdAt: "2026-09-08T11:20:00Z",
  },
  {
    id: "refund_seed_rejected",
    kind: "approval",
    approval: "REJECTED",
    approvalId: "approval_seed_rejected",
    decisionReason: "Delivered and signed for; outside the return window",
    decidedAt: "2026-09-13T10:00:00Z",
    orderId: "order_1004",
    orderNumber: "ORD-1004",
    amountMinor: 78_000,
    reason: "Customer says the order never arrived",
    createdAt: "2026-09-12T16:45:00Z",
  },
  {
    id: "refund_seed_failed",
    kind: "direct",
    status: "FAILED",
    orderId: "order_1005",
    orderNumber: "ORD-1005",
    amountMinor: 4_500,
    reason: "Duplicate charge",
    createdAt: "2026-09-14T13:10:00Z",
  },
  {
    id: "refund_seed_partial",
    kind: "direct",
    status: "PAID",
    orderId: "order_1006",
    orderNumber: "ORD-1006",
    amountMinor: 5_000,
    reason: "Goodwill credit for late delivery",
    createdAt: "2026-09-17T09:40:00Z",
  },
];

const PAYMENT_FAILED_MESSAGE =
  "The payments provider didn't accept this refund. Nothing was paid.";

export async function seedRefunds(db: PrismaClient) {
  for (const { placedAt, ...order } of ORDERS) {
    await db.order.upsert({
      where: { id: order.id },
      update: {},
      create: { ...order, currency: "USD", placedAt: at(placedAt) },
    });
  }

  let created = 0;
  for (const refund of REFUNDS) {
    if (await db.refund.findUnique({ where: { id: refund.id } })) continue;
    await db.$transaction((tx) => seedRefund(tx, refund));
    created++;
  }
  console.log(`Seeded ${ORDERS.length} orders and ${created} refunds`);
}

async function seedRefund(tx: Prisma.TransactionClient, r: SeedRefund) {
  const order = ORDERS.find((o) => o.id === r.orderId)!;
  const createdAt = at(r.createdAt);
  const later = (minutes: number, from = createdAt) =>
    new Date(from.getTime() + minutes * 60_000);
  const entity = { entityType: "Refund", entityId: r.id };
  const base = {
    id: r.id,
    orderId: r.orderId,
    amountMinor: r.amountMinor,
    currency: "USD",
    reason: r.reason,
    requestedById: SUPPORT.id,
    createdAt,
  };

  if (r.kind === "direct") {
    const paid = r.status === "PAID";
    await tx.refund.create({
      data: {
        ...base,
        status: r.status,
        paidAt: paid ? later(1) : null,
        lastError: paid ? null : PAYMENT_FAILED_MESSAGE,
      },
    });
    await tx.mockPayment.create({
      data: {
        idempotencyKey: r.id,
        kind: "refund",
        paymentId: order.paymentId,
        amountMinor: r.amountMinor,
        currency: "USD",
        status: paid ? "SUCCEEDED" : "FAILED",
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          ...entity,
          actorId: SUPPORT.id,
          actorRole: SUPPORT.role,
          action: "refunds.create",
          outcome: "SUCCESS",
          reason: r.reason,
          after: { status: "PROCESSING", amountMinor: r.amountMinor },
          createdAt,
        },
        paid
          ? {
              ...entity,
              actorId: SUPPORT.id,
              actorRole: SUPPORT.role,
              action: "refunds.paid",
              outcome: "SUCCESS",
              before: { status: "PROCESSING" },
              after: { status: "PAID" },
              createdAt: later(1),
            }
          : {
              ...entity,
              actorId: SUPPORT.id,
              actorRole: SUPPORT.role,
              action: "refunds.payment_failed",
              outcome: "FAILURE",
              reason: `Refund declined for ${order.paymentId}`,
              before: { status: "PROCESSING" },
              after: { status: "FAILED" },
              createdAt: later(1),
            },
      ],
    });
    return;
  }

  const decidedAt = r.decidedAt ? at(r.decidedAt) : null;
  const completed = r.approval === "COMPLETED";
  await tx.approvalRequest.create({
    data: {
      id: r.approvalId,
      type: "refunds.issue",
      status: r.approval,
      payload: {
        refundId: r.id,
        orderNumber: r.orderNumber,
        amountMinor: r.amountMinor,
        currency: "USD",
      },
      summary: `Refund ${usd(r.amountMinor)} on order ${r.orderNumber}`,
      ...entity,
      requestedById: SUPPORT.id,
      requestReason: r.reason,
      decidedById: decidedAt ? FINANCE.id : null,
      decisionReason: r.decisionReason ?? null,
      decidedAt,
      processingStartedAt: completed ? decidedAt : null,
      completedAt: completed && decidedAt ? later(1, decidedAt) : null,
      attempts: completed ? 1 : 0,
      createdAt,
    },
  });
  await tx.refund.create({
    data: { ...base, approvalRequestId: r.approvalId },
  });
  if (completed) {
    await tx.mockPayment.create({
      data: {
        idempotencyKey: r.approvalId,
        kind: "refund",
        paymentId: order.paymentId,
        amountMinor: r.amountMinor,
        currency: "USD",
        status: "SUCCEEDED",
      },
    });
  }

  const approvalEntity = {
    entityType: "ApprovalRequest",
    entityId: r.approvalId,
  };
  const audit: Prisma.AuditLogCreateManyInput[] = [
    {
      ...entity,
      actorId: SUPPORT.id,
      actorRole: SUPPORT.role,
      action: "refunds.create",
      outcome: "SUCCESS",
      reason: r.reason,
      after: { amountMinor: r.amountMinor, approvalRequestId: r.approvalId },
      createdAt,
    },
    {
      ...approvalEntity,
      actorId: SUPPORT.id,
      actorRole: SUPPORT.role,
      action: "approvals.request",
      outcome: "SUCCESS",
      reason: r.reason,
      after: { status: "PENDING" },
      createdAt,
    },
  ];
  if (decidedAt && r.approval === "REJECTED") {
    audit.push({
      ...approvalEntity,
      actorId: FINANCE.id,
      actorRole: FINANCE.role,
      action: "approvals.reject",
      outcome: "SUCCESS",
      reason: r.decisionReason,
      before: { status: "PENDING" },
      after: { status: "REJECTED" },
      createdAt: decidedAt,
    });
  }
  if (decidedAt && completed) {
    audit.push(
      {
        ...approvalEntity,
        actorId: FINANCE.id,
        actorRole: FINANCE.role,
        action: "approvals.approve",
        outcome: "SUCCESS",
        reason: r.decisionReason,
        before: { status: "PENDING" },
        after: { status: "PROCESSING" },
        createdAt: decidedAt,
      },
      {
        ...approvalEntity,
        actorId: FINANCE.id,
        actorRole: FINANCE.role,
        action: "approvals.complete",
        outcome: "SUCCESS",
        before: { status: "PROCESSING" },
        after: { status: "COMPLETED" },
        createdAt: later(1, decidedAt),
      },
    );
  }
  await tx.auditLog.createMany({ data: audit });
}

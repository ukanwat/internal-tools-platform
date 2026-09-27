import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import {
  approveApprovalRequest,
  rejectApprovalRequest,
  type ApprovalDeps,
} from "@/platform/approvals/service";
import { createApprovalRegistry } from "@/platform/approvals/registry";
import { db } from "@/platform/db";
import { createMockKycClient } from "@/platform/integrations/kyc/mock";
import {
  createMockPaymentsClient,
  MOCK_PAYMENT_IDS,
} from "@/platform/integrations/payments/mock";
import { revealSensitiveValue } from "@/platform/sensitive/service";

import { getOrder, getRefund, listRefunds, searchOrders } from "./query";
import {
  PAYMENT_FAILED_MESSAGE,
  remainingRefundableMinor,
  requestRefund,
  settleRefunds,
  type RefundDeps,
} from "./service";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const reviewer = seedUser("COMPLIANCE_REVIEWER");

const payments = createMockPaymentsClient();
const kyc = createMockKycClient();
const approvalDeps: ApprovalDeps = { integrations: { kyc, payments } };
const deps: RefundDeps = {
  integrations: { kyc, payments },
  approvalThresholdMinor: 50_000,
  approvals: approvalDeps,
};
const ACCOUNT = "GB29NWBK60161331926819";

let orderCount = 0;
async function newOrder(
  overrides: {
    amountMinor?: number;
    paymentId?: string;
    currency?: string;
  } = {},
) {
  orderCount++;
  return db.order.create({
    data: {
      number: `ORD-T${orderCount}`,
      customerName: "Test Customer",
      customerEmail: `customer${orderCount}@example.com`,
      amountMinor: overrides.amountMinor ?? 200_000,
      currency: overrides.currency ?? "USD",
      paymentId: overrides.paymentId ?? `pay_test_${orderCount}`,
      accountNumber: ACCOUNT,
      placedAt: new Date("2026-09-01T00:00:00Z"),
    },
  });
}

async function refund(
  orderId: string,
  amountMinor: number,
  actor = support,
  extra: RefundDeps = {},
) {
  const result = await requestRefund(
    actor,
    { orderId, amountMinor, reason: "Customer returned the item" },
    { ...deps, ...extra },
  );
  if (!result.ok) throw new Error(result.error);
  return result;
}

const auditFor = (id: string) =>
  db.auditLog.findMany({
    where: { entityType: "Refund", entityId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

describe("requestRefund at or under the threshold", () => {
  it("pays straight away through payments and audits each step", async () => {
    const order = await newOrder();
    const result = await refund(order.id, 50_000);
    expect(result.outcome).toBe("paid");
    expect(result.refund).toMatchObject({
      status: "PAID",
      approvalRequestId: null,
      requestedById: support.id,
    });
    expect(result.refund.paidAt).not.toBeNull();
    expect(await payments.findRefund(result.refund.id)).toMatchObject({
      status: "succeeded",
    });
    expect(await db.approvalRequest.count()).toBe(0);
    expect(await auditFor(result.refund.id)).toMatchObject([
      {
        action: "refunds.create",
        actorId: support.id,
        reason: "Customer returned the item",
      },
      {
        action: "refunds.paid",
        outcome: "SUCCESS",
        reason: "Paid through the payments provider",
      },
    ]);
  });

  it("records a declined payment as failed without showing the provider error", async () => {
    const order = await newOrder({ paymentId: MOCK_PAYMENT_IDS.decline });
    const result = await refund(order.id, 1_000);
    expect(result.outcome).toBe("failed");
    expect(result.refund).toMatchObject({
      status: "FAILED",
      lastError: PAYMENT_FAILED_MESSAGE,
      paidAt: null,
    });
    const audit = await auditFor(result.refund.id);
    expect(audit[1]).toMatchObject({
      action: "refunds.payment_failed",
      outcome: "FAILURE",
      reason: `Refund declined for ${MOCK_PAYMENT_IDS.decline}`,
    });
    expect(await remainingRefundableMinor(order)).toBe(order.amountMinor);
  });

  it("leaves a slow payment processing and settles it from the provider later", async () => {
    const order = await newOrder({ paymentId: MOCK_PAYMENT_IDS.hang });
    const result = await refund(order.id, 1_000, support, {
      processingTimeoutMs: 20,
    });
    expect(result.outcome).toBe("processing");
    const later = {
      ...deps,
      processingTimeoutMs: 20,
      now: () => new Date(Date.now() + 60_000),
    };

    expect(await settleRefunds(later)).toEqual({ settled: 0 });
    await db.mockPayment.update({
      where: { idempotencyKey: result.refund.id },
      data: { status: "SUCCEEDED" },
    });
    expect(await settleRefunds(later)).toEqual({ settled: 1 });
    expect(
      await db.refund.findUniqueOrThrow({ where: { id: result.refund.id } }),
    ).toMatchObject({ status: "PAID" });
  });

  it("resends a stuck refund the provider never received under the same key", async () => {
    const order = await newOrder();
    const stuck = await db.refund.create({
      data: {
        orderId: order.id,
        amountMinor: 1_000,
        currency: "USD",
        reason: "r",
        requestedById: support.id,
        status: "PROCESSING",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    expect(await settleRefunds(deps)).toEqual({ settled: 1 });
    expect(
      await db.refund.findUniqueOrThrow({ where: { id: stuck.id } }),
    ).toMatchObject({ status: "PAID" });
    expect(
      await db.mockPayment.count({ where: { idempotencyKey: stuck.id } }),
    ).toBe(1);
    // A late original call is replayed, not paid again.
    await expect(
      payments.refund({
        idempotencyKey: stuck.id,
        paymentId: order.paymentId,
        amountMinor: 1_000,
        currency: "USD",
      }),
    ).resolves.toMatchObject({ replayed: true });
  });
});

describe("requestRefund over the threshold", () => {
  it("sends it to finance and pays nothing yet", async () => {
    const order = await newOrder();
    const result = await refund(order.id, 50_001);
    expect(result.outcome).toBe("awaiting_approval");
    expect(result.refund.status).toBeNull();
    const request = await db.approvalRequest.findUniqueOrThrow({
      where: { id: result.refund.approvalRequestId! },
    });
    expect(request).toMatchObject({
      type: "refunds.issue",
      status: "PENDING",
      summary: `Refund $500.01 on order ${order.number}`,
      entityType: "Refund",
      entityId: result.refund.id,
      requestedById: support.id,
    });
    expect(await db.mockPayment.count()).toBe(0);
  });

  it("uses the configured threshold", async () => {
    const order = await newOrder();
    const result = await refund(order.id, 60_000, support, {
      approvalThresholdMinor: 75_000,
    });
    expect(result.outcome).toBe("paid");
  });

  it("always needs approval for non-USD refunds", async () => {
    const order = await newOrder({ currency: "EUR" });
    expect((await refund(order.id, 100)).outcome).toBe("awaiting_approval");
  });

  it("does not let the requester approve their own refund", async () => {
    const order = await newOrder();
    const { refund: created } = await refund(order.id, 60_000);
    // Someone who requested a refund and later moved to finance.
    await db.approvalRequest.update({
      where: { id: created.approvalRequestId! },
      data: { requestedById: finance.id },
    });
    const result = await approveApprovalRequest(
      finance,
      created.approvalRequestId!,
      "Looks fine",
      approvalDeps,
    );
    expect(result.ok).toBe(false);
    expect(await db.mockPayment.count()).toBe(0);
    expect((await getRefund(finance, created.id))?.refund.state).toBe(
      "AWAITING_APPROVAL",
    );
  });

  it("does not let support approve", async () => {
    const order = await newOrder();
    const { refund: created } = await refund(order.id, 60_000);
    const result = await approveApprovalRequest(
      support,
      created.approvalRequestId!,
      "ok",
      approvalDeps,
    );
    expect(result.ok).toBe(false);
  });

  it("pays through payments once finance approves", async () => {
    const order = await newOrder();
    const { refund: created } = await refund(order.id, 60_000);
    const result = await approveApprovalRequest(
      finance,
      created.approvalRequestId!,
      "Confirmed with the warehouse",
      approvalDeps,
    );
    expect(result).toMatchObject({
      ok: true,
      request: { status: "COMPLETED" },
    });
    expect(await payments.findRefund(created.approvalRequestId!)).toMatchObject(
      { status: "succeeded" },
    );
    const view = await getRefund(finance, created.id);
    expect(view?.refund.state).toBe("PAID");
    expect(view?.refund.paidAt).not.toBeNull();
  });

  it("frees the amount again when finance rejects", async () => {
    const order = await newOrder({ amountMinor: 60_000 });
    const { refund: created } = await refund(order.id, 60_000);
    expect(await remainingRefundableMinor(order)).toBe(0);
    await rejectApprovalRequest(
      finance,
      created.approvalRequestId!,
      "Outside the return window",
      approvalDeps,
    );
    expect((await getRefund(support, created.id))?.refund.state).toBe(
      "REJECTED",
    );
    expect(await remainingRefundableMinor(order)).toBe(60_000);
  });
});

describe("requestRefund checks", () => {
  it("blocks and logs roles that cannot request refunds", async () => {
    const order = await newOrder();
    for (const actor of [finance, reviewer]) {
      const result = await requestRefund(
        actor,
        { orderId: order.id, amountMinor: 100, reason: "r" },
        deps,
      );
      expect(result).toEqual({
        ok: false,
        error: "You cannot request refunds",
      });
    }
    expect(
      await db.auditLog.count({
        where: { action: "refunds.request", outcome: "DENIED" },
      }),
    ).toBe(2);
    expect(await db.refund.count()).toBe(0);
  });

  it("requires a reason and a positive whole amount", async () => {
    const order = await newOrder();
    const input = { orderId: order.id, amountMinor: 100, reason: "r" };
    expect(
      await requestRefund(support, { ...input, reason: "  " }, deps),
    ).toMatchObject({ ok: false });
    for (const amountMinor of [0, -5, 1.5, 100_000_000_01]) {
      expect(
        await requestRefund(support, { ...input, amountMinor }, deps),
      ).toMatchObject({ ok: false });
    }
    expect(await db.refund.count()).toBe(0);
  });

  it("cannot refund more than is left on the order, including pending refunds", async () => {
    const order = await newOrder({ amountMinor: 80_000 });
    await refund(order.id, 60_000);
    const result = await requestRefund(
      support,
      { orderId: order.id, amountMinor: 30_000, reason: "r" },
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: "Only $200.00 is left to refund on this order",
    });
    await refund(order.id, 20_000);
    expect(
      await requestRefund(
        support,
        { orderId: order.id, amountMinor: 1, reason: "r" },
        deps,
      ),
    ).toEqual({
      ok: false,
      error: "This order has already been fully refunded",
    });
  });

  it("does not over-refund under concurrent requests", async () => {
    const order = await newOrder({ amountMinor: 10_000 });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        requestRefund(
          support,
          { orderId: order.id, amountMinor: 6_000, reason: "r" },
          deps,
        ),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("rejects unknown orders", async () => {
    expect(
      await requestRefund(
        support,
        { orderId: "missing", amountMinor: 100, reason: "r" },
        deps,
      ),
    ).toEqual({ ok: false, error: "Order not found" });
  });

  it("rolls back the refund if the approval request cannot be created", async () => {
    const order = await newOrder();
    await expect(
      requestRefund(
        support,
        { orderId: order.id, amountMinor: 60_000, reason: "r" },
        { ...deps, approvals: { registry: createApprovalRegistry([]) } },
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(await db.refund.count()).toBe(0);
    expect(
      await db.auditLog.count({ where: { action: "refunds.create" } }),
    ).toBe(0);
  });
});

describe("account numbers", () => {
  it("are masked for everyone and only finance can reveal them", async () => {
    const order = await newOrder();
    const supportView = await getOrder(support, order.id);
    const financeView = await getOrder(finance, order.id);
    expect(supportView?.order.accountNumber).toMatchObject({
      masked: "••••6819",
      canReveal: false,
    });
    expect(JSON.stringify(supportView)).not.toContain(ACCOUNT);
    expect(financeView?.order.accountNumber).toMatchObject({
      masked: "••••6819",
      canReveal: true,
    });
    expect(JSON.stringify(financeView)).not.toContain(ACCOUNT);

    const entity = { type: "Order", id: order.id };
    expect(
      await revealSensitiveValue(support, {
        field: "accountNumber",
        entity,
        reason: "r",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await revealSensitiveValue(finance, {
        field: "accountNumber",
        entity,
        reason: "Checking refund destination",
      }),
    ).toEqual({ ok: true, value: ACCOUNT });
  });
});

describe("queries", () => {
  it("finds orders by number, name or email", async () => {
    const order = await newOrder();
    await newOrder();
    for (const q of [
      order.number.toLowerCase(),
      order.customerEmail,
      "test cust",
    ]) {
      const found = await searchOrders(q);
      expect(found.map((o) => o.id)).toContain(order.id);
    }
    expect(await searchOrders(order.customerEmail)).toHaveLength(1);
    expect(await searchOrders("nothing-matches")).toHaveLength(0);
  });

  it("filters refunds by their combined state", async () => {
    const order = await newOrder();
    const paid = await refund(order.id, 1_000);
    const pending = await refund(order.id, 60_000);
    const awaiting = await listRefunds({ state: "AWAITING_APPROVAL" });
    expect(awaiting.refunds.map((r) => r.id)).toEqual([pending.refund.id]);
    const paidList = await listRefunds({ state: "PAID" });
    expect(paidList.refunds.map((r) => r.id)).toEqual([paid.refund.id]);
    expect((await listRefunds({})).total).toBe(2);
  });
});

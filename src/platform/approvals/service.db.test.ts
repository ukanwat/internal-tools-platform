import { describe, expect, it } from "vitest";

import { testRegistry } from "../../../test/approvals";
import { seedUser, setupTestDatabase } from "../../../test/db";

import { db } from "@/platform/db";
import type { Integrations } from "@/platform/integrations";
import {
  createMockPaymentsClient,
  MOCK_PAYMENT_IDS,
} from "@/platform/integrations/payments/mock";

import {
  approveApprovalRequest,
  createApprovalRequest,
  rejectApprovalRequest,
  settleApprovals,
  type ApprovalDeps,
} from "./service";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const lead = seedUser("COMPLIANCE_LEAD");

const realPayments = createMockPaymentsClient();
const deps: ApprovalDeps = {
  registry: testRegistry,
  integrations: { payments: realPayments },
};
/** A provider whose outcome lookups can't tell yet. */
const stuckPayments: Integrations["payments"] = {
  ...realPayments,
  findRefund: () => Promise.reject(new Error("Provider unavailable")),
};

async function newRequest(paymentId = "pay_1", requester = support) {
  const result = await createApprovalRequest(
    requester,
    {
      type: "test.refund",
      payload: { paymentId, amountMinor: 1200, currency: "USD" },
      reason: "Customer charged twice",
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error);
  return result.request;
}

const auditFor = (id: string) =>
  db.auditLog.findMany({
    where: { entityType: "ApprovalRequest", entityId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

describe("createApprovalRequest", () => {
  it("creates a pending request and audits it in one go", async () => {
    const request = await newRequest();
    expect(request).toMatchObject({
      status: "PENDING",
      summary: "Refund 12.00 USD on pay_1",
      entityType: "Payment",
      entityId: "pay_1",
      requestedById: support.id,
      requestReason: "Customer charged twice",
    });
    const audit = await auditFor(request.id);
    expect(audit).toMatchObject([
      { action: "approvals.request", outcome: "SUCCESS", actorId: support.id },
    ]);
  });

  it("blocks and logs a requester without the request permission", async () => {
    const result = await createApprovalRequest(
      finance,
      {
        type: "test.refund",
        payload: { paymentId: "pay_1", amountMinor: 1, currency: "USD" },
        reason: "x",
      },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(await db.approvalRequest.count()).toBe(0);
    expect(
      await db.auditLog.findFirst({
        where: { actorId: finance.id, outcome: "DENIED" },
      }),
    ).toMatchObject({ action: "refunds.request" });
  });

  it("requires a reason and a valid payload", async () => {
    const base = {
      type: "test.refund",
      payload: { paymentId: "pay_1", amountMinor: 1, currency: "USD" },
    };
    expect(
      await createApprovalRequest(support, { ...base, reason: "  " }, deps),
    ).toEqual({
      ok: false,
      error: "A reason is required",
    });
    const invalid = await createApprovalRequest(
      support,
      { ...base, payload: { paymentId: "pay_1" }, reason: "x" },
      deps,
    );
    expect(invalid.ok).toBe(false);
    expect(await db.approvalRequest.count()).toBe(0);
  });
});

describe("approveApprovalRequest", () => {
  it("processes the approval and completes it", async () => {
    const request = await newRequest();
    const result = await approveApprovalRequest(
      finance,
      request.id,
      "Verified duplicate",
      deps,
    );
    expect(result).toMatchObject({
      ok: true,
      request: {
        status: "COMPLETED",
        decidedById: finance.id,
        attempts: 1,
        lastError: null,
      },
    });
    expect(
      await db.mockPayment.findUnique({
        where: { idempotencyKey: request.id },
      }),
    ).toMatchObject({
      paymentId: "pay_1",
      amountMinor: 1200,
    });
    const audit = await auditFor(request.id);
    expect(audit.map((a) => [a.action, a.outcome])).toEqual([
      ["approvals.request", "SUCCESS"],
      ["approvals.approve", "SUCCESS"],
      ["approvals.complete", "SUCCESS"],
    ]);
    expect(audit[1]).toMatchObject({
      reason: "Verified duplicate",
      before: expect.objectContaining({ status: "PENDING" }),
      after: expect.objectContaining({ status: "PROCESSING" }),
    });
  });

  it("marks the request PROCESSING before running the approved action", async () => {
    const request = await newRequest();
    let statusDuringExecution: string | undefined;
    const spying: Integrations = {
      payments: {
        async refund() {
          const current = await db.approvalRequest.findUniqueOrThrow({
            where: { id: request.id },
          });
          statusDuringExecution = current.status;
          return { refundId: "r", replayed: false };
        },
        findRefund: async () => null,
      },
    };
    await approveApprovalRequest(finance, request.id, "ok", {
      ...deps,
      integrations: spying,
    });
    expect(statusDuringExecution).toBe("PROCESSING");
  });

  it("blocks and logs approving your own request", async () => {
    const selfRequest = await newRequest();
    // Same person, with a role that could otherwise decide it.
    const asRequester = { ...support, role: "FINANCE_APPROVER" as const };
    const result = await approveApprovalRequest(
      asRequester,
      selfRequest.id,
      "mine",
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: "You cannot decide your own request",
    });
    expect(
      (
        await db.approvalRequest.findUniqueOrThrow({
          where: { id: selfRequest.id },
        })
      ).status,
    ).toBe("PENDING");
    expect(
      await db.auditLog.findFirst({
        where: { entityId: selfRequest.id, outcome: "DENIED" },
      }),
    ).toMatchObject({
      action: "approvals.approve",
      actorId: support.id,
      reason: "Cannot decide your own request",
    });
    expect(await db.mockPayment.count()).toBe(0);
  });

  it("blocks and logs a decider without the decide permission", async () => {
    const request = await newRequest();
    const result = await approveApprovalRequest(lead, request.id, "sure", deps);
    expect(result.ok).toBe(false);
    expect(
      await db.auditLog.findFirst({
        where: { actorId: lead.id, outcome: "DENIED" },
      }),
    ).toMatchObject({ action: "refunds.approve", entityId: request.id });
    expect(await db.mockPayment.count()).toBe(0);
  });

  it("requires a reason", async () => {
    const request = await newRequest();
    expect(
      await approveApprovalRequest(finance, request.id, " ", deps),
    ).toEqual({
      ok: false,
      error: "A reason is required",
    });
  });

  it("lets only one of two simultaneous approvals run", async () => {
    const request = await newRequest();
    const other = { ...finance, id: "user_admin" };
    const results = await Promise.all([
      approveApprovalRequest(finance, request.id, "a", deps),
      approveApprovalRequest(other, request.id, "b", deps),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.mockPayment.count()).toBe(1);
    expect(
      await db.auditLog.count({
        where: { entityId: request.id, outcome: "DENIED" },
      }),
    ).toBe(1);
  });

  it("puts a failed request back to pending with the error, logs it, and allows a retry", async () => {
    const request = await newRequest(MOCK_PAYMENT_IDS.decline);
    const result = await approveApprovalRequest(
      finance,
      request.id,
      "ok",
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: "Approved, but processing failed. The request is back to pending.",
    });
    const after = await db.approvalRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(after).toMatchObject({
      status: "PENDING",
      lastError: "Processing failed. The request is back to pending.",
      attempts: 1,
      processingStartedAt: null,
      decidedById: null,
    });
    expect(
      await db.auditLog.findFirst({
        where: { entityId: request.id, action: "approvals.fail" },
      }),
    ).toMatchObject({
      outcome: "FAILURE",
      actorId: finance.id,
      reason: `Refund declined for ${MOCK_PAYMENT_IDS.decline}`,
    });

    const retry = await approveApprovalRequest(
      finance,
      request.id,
      "retry",
      deps,
    );
    expect(retry.ok).toBe(false);
    expect(
      (
        await db.approvalRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).attempts,
    ).toBe(2);
  });

  it("marks a timed-out request outcome unknown so it can't be decided again", async () => {
    const request = await newRequest(MOCK_PAYMENT_IDS.hang);
    const result = await approveApprovalRequest(finance, request.id, "ok", {
      ...deps,
      processingTimeoutMs: 50,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/^Approved, but processing timed out/),
    });
    expect(
      await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).toMatchObject({ status: "OUTCOME_UNKNOWN", decidedById: finance.id });
    expect(
      await db.auditLog.findFirst({
        where: { entityId: request.id, action: "approvals.outcome_unknown" },
      }),
    ).toMatchObject({
      outcome: "FAILURE",
      reason: expect.stringMatching(/Timed out/),
    });

    expect(
      await rejectApprovalRequest(lead, request.id, "no", {
        ...deps,
        integrations: { payments: stuckPayments },
      }),
    ).toMatchObject({ ok: false });
    expect(
      await approveApprovalRequest(lead, request.id, "again", {
        ...deps,
        integrations: { payments: stuckPayments },
      }),
    ).toMatchObject({ ok: false });
  });

  it("completes a timed-out request once its late execution finishes", async () => {
    const request = await newRequest();
    let finish = () => {};
    const slowPayments: Integrations["payments"] = {
      ...realPayments,
      async refund(input) {
        await new Promise<void>((resolve) => (finish = resolve));
        return realPayments.refund(input);
      },
    };
    const result = await approveApprovalRequest(finance, request.id, "ok", {
      ...deps,
      integrations: { payments: slowPayments },
      processingTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    finish();
    await expect
      .poll(
        async () =>
          (
            await db.approvalRequest.findUniqueOrThrow({
              where: { id: request.id },
            })
          ).status,
      )
      .toBe("COMPLETED");
    expect(await db.mockPayment.count()).toBe(1);
  });
});

describe("rejectApprovalRequest", () => {
  it("rejects with a reason and audits it", async () => {
    const request = await newRequest();
    const result = await rejectApprovalRequest(
      finance,
      request.id,
      "Not a duplicate",
      deps,
    );
    expect(result).toMatchObject({
      ok: true,
      request: {
        status: "REJECTED",
        decisionReason: "Not a duplicate",
        decidedById: finance.id,
      },
    });
    expect(await db.mockPayment.count()).toBe(0);
    expect(
      await db.auditLog.findFirst({
        where: { entityId: request.id, action: "approvals.reject" },
      }),
    ).toMatchObject({ outcome: "SUCCESS", reason: "Not a duplicate" });
  });

  it("requires a reason", async () => {
    const request = await newRequest();
    expect(await rejectApprovalRequest(finance, request.id, "", deps)).toEqual({
      ok: false,
      error: "A reason is required",
    });
  });

  it("blocks and logs deciding an already-decided request", async () => {
    const request = await newRequest();
    await rejectApprovalRequest(finance, request.id, "no", deps);
    const again = await approveApprovalRequest(
      finance,
      request.id,
      "yes",
      deps,
    );
    expect(again.ok).toBe(false);
    expect(
      await db.auditLog.findFirst({
        where: { entityId: request.id, outcome: "DENIED" },
      }),
    ).toMatchObject({
      action: "approvals.approve",
      reason: "Request is REJECTED, not PENDING",
    });
  });
});

describe("settleApprovals", () => {
  it("marks requests stuck in processing past the timeout outcome unknown", async () => {
    const stale = await newRequest("pay_stale");
    const fresh = await newRequest("pay_fresh");
    const now = new Date();
    for (const [id, ageMs] of [
      [stale.id, 6 * 60_000],
      [fresh.id, 60_000],
    ] as const) {
      await db.approvalRequest.update({
        where: { id },
        data: {
          status: "PROCESSING",
          decidedById: finance.id,
          processingStartedAt: new Date(now.getTime() - ageMs),
        },
      });
    }

    const result = await settleApprovals({
      ...deps,
      integrations: { payments: stuckPayments },
      now: () => now,
    });

    expect(result).toEqual({ timedOut: 1, settled: 0 });
    expect(
      (await db.approvalRequest.findUniqueOrThrow({ where: { id: stale.id } }))
        .status,
    ).toBe("OUTCOME_UNKNOWN");
    expect(
      (await db.approvalRequest.findUniqueOrThrow({ where: { id: fresh.id } }))
        .status,
    ).toBe("PROCESSING");
    expect(
      await db.auditLog.findFirst({
        where: { entityId: stale.id, action: "approvals.outcome_unknown" },
      }),
    ).toMatchObject({
      outcome: "FAILURE",
      actorId: null,
      reason: "Timed out after 300s in processing",
    });
  });

  it("completes unknown requests whose refund went through and reopens the rest", async () => {
    const paid = await newRequest("pay_paid");
    const unpaid = await newRequest("pay_unpaid");
    for (const { id } of [paid, unpaid]) {
      await db.approvalRequest.update({
        where: { id },
        data: { status: "OUTCOME_UNKNOWN", decidedById: finance.id },
      });
    }
    await realPayments.refund({
      idempotencyKey: paid.id,
      paymentId: "pay_paid",
      amountMinor: 1200,
      currency: "USD",
    });

    expect(await settleApprovals(deps)).toEqual({ timedOut: 0, settled: 2 });

    expect(
      await db.approvalRequest.findUniqueOrThrow({ where: { id: paid.id } }),
    ).toMatchObject({ status: "COMPLETED", lastError: null });
    expect(
      await db.approvalRequest.findUniqueOrThrow({ where: { id: unpaid.id } }),
    ).toMatchObject({
      status: "PENDING",
      decidedById: null,
      lastError: "Processing failed. The request is back to pending.",
    });
    expect(
      await db.auditLog.findFirst({
        where: { entityId: unpaid.id, action: "approvals.fail" },
      }),
    ).toMatchObject({
      outcome: "FAILURE",
      reason: "Confirmed as not applied after timing out",
    });
  });
});

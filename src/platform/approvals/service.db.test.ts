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
  failStaleApprovals,
  rejectApprovalRequest,
  type ApprovalDeps,
} from "./service";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const lead = seedUser("COMPLIANCE_LEAD");

const deps: ApprovalDeps = {
  registry: testRegistry,
  integrations: { payments: createMockPaymentsClient() },
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
      error: `Approved, but processing failed: Refund declined for ${MOCK_PAYMENT_IDS.decline}`,
    });
    const after = await db.approvalRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(after).toMatchObject({
      status: "PENDING",
      lastError: `Refund declined for ${MOCK_PAYMENT_IDS.decline}`,
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
      reason: after.lastError,
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

  it("treats execution that outlives the timeout as failed", async () => {
    const request = await newRequest(MOCK_PAYMENT_IDS.hang);
    const result = await approveApprovalRequest(finance, request.id, "ok", {
      ...deps,
      processingTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    expect(
      await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).toMatchObject({
      status: "PENDING",
      lastError: expect.stringMatching(/Timed out/),
    });
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

describe("failStaleApprovals", () => {
  it("returns requests stuck in processing past the timeout to pending and logs it", async () => {
    const stale = await newRequest("pay_stale");
    const fresh = await newRequest("pay_fresh");
    const now = new Date();
    await db.approvalRequest.update({
      where: { id: stale.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(now.getTime() - 6 * 60_000),
      },
    });
    await db.approvalRequest.update({
      where: { id: fresh.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(now.getTime() - 60_000),
      },
    });

    expect(await failStaleApprovals({ ...deps, now: () => now })).toBe(1);

    expect(
      await db.approvalRequest.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({
      status: "PENDING",
      lastError: "Timed out after 300s in processing",
    });
    expect(
      (await db.approvalRequest.findUniqueOrThrow({ where: { id: fresh.id } }))
        .status,
    ).toBe("PROCESSING");
    expect(
      await db.auditLog.findFirst({
        where: { entityId: stale.id, action: "approvals.fail" },
      }),
    ).toMatchObject({ outcome: "FAILURE", actorId: null });
  });
});

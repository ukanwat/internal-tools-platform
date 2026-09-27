import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import {
  approveApprovalRequest,
  rejectApprovalRequest,
} from "@/platform/approvals/service";
import {
  listAttachments,
  uploadAttachment,
} from "@/platform/attachments/service";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { getIntegrations } from "@/platform/integrations";
import { createMemoryFileStorage } from "@/platform/integrations/storage";
import { revealSensitiveValue } from "@/platform/sensitive/service";

import { kycDecisionApprovalType } from "./approval-type";
import { kycEntity } from "./cases";
import { decideKycCase, getKycCaseDetail, listKycCases } from "./service";
import { SEED_KYC_CASES } from "./seed-cases";

setupTestDatabase();

const support = seedUser("SUPPORT");
const reviewer = seedUser("COMPLIANCE_REVIEWER");
const lead = seedUser("COMPLIANCE_LEAD");
const secondLead: CurrentUser = {
  id: "user_compliance_lead_2",
  email: "lou.lead@example.com",
  name: "Lou Lead",
  role: "COMPLIANCE_LEAD",
};

const LOW = "kyc_case_1001";
const MEDIUM = "kyc_case_1002";
const HIGH = "kyc_case_1003";
const UNAVAILABLE = "kyc_case_1006";
const HIGH_ID_NUMBER = "T4418093Q";

beforeEach(async () => {
  await db.user.create({ data: secondLead });
  await db.kycCase.createMany({ data: [...SEED_KYC_CASES] });
});
afterEach(() => vi.unstubAllEnvs());

const caseOf = (id: string) => db.kycCase.findUniqueOrThrow({ where: { id } });

async function submitHighRisk(actor: CurrentUser = reviewer) {
  const result = await decideKycCase(actor, {
    caseId: HIGH,
    decision: "approve",
    reason: "PEP match is a namesake; DOB differs",
  });
  expect(result).toEqual({
    ok: true,
    message: "Sent to a compliance lead for approval",
  });
  return db.approvalRequest.findFirstOrThrow({
    where: { entityType: "KycCase", entityId: HIGH },
  });
}

describe("who can see KYC cases", () => {
  it("blocks support and logs the attempt", async () => {
    const result = await decideKycCase(support, {
      caseId: LOW,
      decision: "approve",
      reason: "looks fine",
    });
    expect(result.ok).toBe(false);
    expect((await caseOf(LOW)).status).toBe("OPEN");
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: support.id } }),
    ).toMatchObject({
      action: "kyc.review",
      outcome: "DENIED",
      entityType: "KycCase",
      entityId: LOW,
    });
  });

  it("does not let support reveal ID numbers or see supporting documents", async () => {
    const reveal = await revealSensitiveValue(support, {
      field: "idNumber",
      entity: kycEntity(HIGH),
      reason: "curious",
    });
    expect(reveal.ok).toBe(false);
    const files = await listAttachments(support, kycEntity(HIGH));
    expect(files).toMatchObject({ canView: false, canUpload: false });
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: support.id } }),
    ).toMatchObject({
      action: "pii.reveal_id_number",
      outcome: "DENIED",
      entityId: HIGH,
    });
  });
});

describe("the review queue", () => {
  it("filters by status and risk and flags cases waiting for a lead", async () => {
    await submitHighRisk();
    const { cases } = await listKycCases({
      status: "OPEN",
      risk: "HIGH",
      page: 1,
    });
    expect(cases.map((c) => [c.id, c.awaitingLeadApproval])).toEqual([
      [HIGH, true],
      ["kyc_case_1004", false],
    ]);
  });
});

describe("deciding low and medium risk cases", () => {
  it("approves with a reason and audits the change in one go", async () => {
    const result = await decideKycCase(reviewer, {
      caseId: LOW,
      decision: "approve",
      reason: " All checks clear ",
    });
    expect(result).toEqual({ ok: true, message: "Case approved" });
    expect(await caseOf(LOW)).toMatchObject({
      status: "APPROVED",
      reviewedById: reviewer.id,
      decidedById: reviewer.id,
      decisionReason: "All checks clear",
    });
    expect(
      await db.auditLog.findFirstOrThrow({ where: { action: "kyc.approve" } }),
    ).toMatchObject({
      actorId: reviewer.id,
      outcome: "SUCCESS",
      entityId: LOW,
      reason: "All checks clear",
      before: expect.objectContaining({ status: "OPEN" }),
      after: expect.objectContaining({ status: "APPROVED" }),
    });
  });

  it("rejects with a reason", async () => {
    await decideKycCase(reviewer, {
      caseId: MEDIUM,
      decision: "reject",
      reason: "Address could not be verified",
    });
    expect((await caseOf(MEDIUM)).status).toBe("REJECTED");
  });

  it("requires a reason", async () => {
    expect(
      await decideKycCase(reviewer, {
        caseId: LOW,
        decision: "approve",
        reason: "  ",
      }),
    ).toEqual({ ok: false, message: "A reason is required" });
    expect((await caseOf(LOW)).status).toBe("OPEN");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuses and logs a second decision on the same case", async () => {
    await decideKycCase(reviewer, {
      caseId: LOW,
      decision: "approve",
      reason: "Clear",
    });
    const again = await decideKycCase(lead, {
      caseId: LOW,
      decision: "reject",
      reason: "Changed my mind",
    });
    expect(again).toEqual({
      ok: false,
      message: "This case has already been decided",
    });
    expect((await caseOf(LOW)).status).toBe("APPROVED");
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: lead.id } }),
    ).toMatchObject({ action: "kyc.reject", outcome: "DENIED" });
  });

  it("sends medium risk cases to a lead when configured to", async () => {
    vi.stubEnv("KYC_LEAD_APPROVAL_RISK_LEVELS", "MEDIUM");
    const result = await decideKycCase(reviewer, {
      caseId: MEDIUM,
      decision: "approve",
      reason: "Utility bill uploaded",
    });
    expect(result.message).toBe("Sent to a compliance lead for approval");
    expect((await caseOf(MEDIUM)).status).toBe("OPEN");
  });
});

describe("high risk cases", () => {
  it("need a compliance lead: the reviewer's decision becomes an approval request", async () => {
    const request = await submitHighRisk();
    expect(request).toMatchObject({
      type: "kyc.decision",
      status: "PENDING",
      requestedById: reviewer.id,
      summary: "Approve KYC case for Priya Raman",
    });
    expect((await caseOf(HIGH)).status).toBe("OPEN");
  });

  it("are decided when a different compliance lead approves", async () => {
    const request = await submitHighRisk();
    const result = await approveApprovalRequest(
      lead,
      request.id,
      "Agree, namesake",
    );
    expect(result.ok).toBe(true);
    expect(await caseOf(HIGH)).toMatchObject({
      status: "APPROVED",
      reviewedById: reviewer.id,
      decidedById: lead.id,
      decisionReason: "PEP match is a namesake; DOB differs",
      approvalRequestId: request.id,
    });
    expect(
      await db.auditLog.findFirstOrThrow({
        where: { action: "kyc.approve", entityId: HIGH },
      }),
    ).toMatchObject({ actorId: lead.id, reason: "Agree, namesake" });
  });

  it("cannot be approved by the lead who reviewed them", async () => {
    const request = await submitHighRisk(lead);
    const self = await approveApprovalRequest(lead, request.id, "Fine");
    expect(self.ok).toBe(false);
    expect((await caseOf(HIGH)).status).toBe("OPEN");

    const other = await approveApprovalRequest(secondLead, request.id, "Agree");
    expect(other.ok).toBe(true);
    expect(await caseOf(HIGH)).toMatchObject({
      reviewedById: lead.id,
      decidedById: secondLead.id,
    });
  });

  it("cannot be signed off by a reviewer", async () => {
    const request = await submitHighRisk();
    const result = await approveApprovalRequest(reviewer, request.id, "ok");
    expect(result.ok).toBe(false);
    expect((await caseOf(HIGH)).status).toBe("OPEN");
  });

  it("stay open when the lead rejects the request, so they can be reviewed again", async () => {
    const request = await submitHighRisk();
    await rejectApprovalRequest(lead, request.id, "Need source of funds");
    expect((await caseOf(HIGH)).status).toBe("OPEN");
    await submitHighRisk();
  });

  it("cannot be sent twice or decided another way while a lead is looking", async () => {
    await submitHighRisk();
    const again = await decideKycCase(lead, {
      caseId: HIGH,
      decision: "reject",
      reason: "Reject instead",
    });
    expect(again).toEqual({
      ok: false,
      message: "This case is already waiting for a compliance lead",
    });
    expect(await db.approvalRequest.count()).toBe(1);
    expect(
      await db.auditLog.findFirstOrThrow({
        where: { action: "approvals.request", outcome: "DENIED" },
      }),
    ).toMatchObject({
      actorId: lead.id,
      entityType: "KycCase",
      entityId: HIGH,
      reason: "This case is already waiting for a compliance lead",
    });
  });

  it("are not decided by an execution that outlived its timeout", async () => {
    const request = await submitHighRisk();
    await db.approvalRequest.update({
      where: { id: request.id },
      data: { status: "OUTCOME_UNKNOWN", decidedById: lead.id },
    });
    await expect(
      kycDecisionApprovalType.execute({
        request: {
          id: request.id,
          requestedById: reviewer.id,
          decidedById: lead.id,
        },
        payload: request.payload,
        idempotencyKey: request.id,
        integrations: getIntegrations(),
      }),
    ).rejects.toThrow("Approval request is OUTCOME_UNKNOWN");
    expect((await caseOf(HIGH)).status).toBe("OPEN");
  });
});

describe("vendor check results", () => {
  it("are needed to approve a case, but not to reject it", async () => {
    const approve = await decideKycCase(reviewer, {
      caseId: UNAVAILABLE,
      decision: "approve",
      reason: "Looks fine",
    });
    expect(approve).toEqual({
      ok: false,
      message: "Can't approve without the KYC vendor's check results",
    });
    expect(
      await db.auditLog.findFirstOrThrow({ where: { action: "kyc.approve" } }),
    ).toMatchObject({ outcome: "DENIED", entityId: UNAVAILABLE });
    expect((await caseOf(UNAVAILABLE)).status).toBe("OPEN");

    const reject = await decideKycCase(reviewer, {
      caseId: UNAVAILABLE,
      decision: "reject",
      reason: "Customer withdrew",
    });
    expect(reject.ok).toBe(true);
  });
});

describe("ID numbers", () => {
  it("are masked in the case view", async () => {
    const detail = await getKycCaseDetail(reviewer, HIGH);
    expect(detail?.idNumber).toMatchObject({
      masked: "••••093Q",
      canReveal: true,
    });
    expect(JSON.stringify(detail)).not.toContain(HIGH_ID_NUMBER);
  });

  it("are revealed only with a reason, and the reveal is logged", async () => {
    expect(
      await revealSensitiveValue(reviewer, {
        field: "idNumber",
        entity: kycEntity(HIGH),
        reason: " ",
      }),
    ).toEqual({ ok: false, error: "A reason is required" });

    const result = await revealSensitiveValue(reviewer, {
      field: "idNumber",
      entity: kycEntity(HIGH),
      reason: "Compare with PEP record",
    });
    expect(result).toEqual({ ok: true, value: HIGH_ID_NUMBER });
    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: "sensitive.reveal" },
    });
    expect(entry).toMatchObject({
      actorId: reviewer.id,
      entityType: "KycCase",
      entityId: HIGH,
      reason: "Compare with PEP record",
    });
    expect(JSON.stringify(entry)).not.toContain(HIGH_ID_NUMBER);
  });

  it("show the vendor being down instead of failing the page", async () => {
    const detail = await getKycCaseDetail(reviewer, UNAVAILABLE);
    expect(detail).toMatchObject({ check: null, vendorUnavailable: true });
    expect(detail?.idNumber.masked).toBeNull();
  });
});

describe("supporting documents", () => {
  const storage = createMemoryFileStorage();
  const file = {
    name: "source-of-funds.pdf",
    bytes: new TextEncoder().encode("%PDF-1.7 payslip"),
  };

  it("can be attached by reviewers while the case is open", async () => {
    const result = await uploadAttachment(
      reviewer,
      { entity: kycEntity(LOW), file },
      { storage },
    );
    expect(result.ok).toBe(true);
    const list = await listAttachments(lead, kycEntity(LOW));
    expect(list.attachments.map((a) => a.filename)).toEqual([
      "source-of-funds.pdf",
    ]);
  });

  it("cannot be attached once the case is decided", async () => {
    await decideKycCase(reviewer, {
      caseId: LOW,
      decision: "approve",
      reason: "Clear",
    });
    const result = await uploadAttachment(
      reviewer,
      { entity: kycEntity(LOW), file },
      { storage },
    );
    expect(result.ok).toBe(false);
  });

  it("cannot be attached by support", async () => {
    const result = await uploadAttachment(
      support,
      { entity: kycEntity(LOW), file },
      { storage },
    );
    expect(result.ok).toBe(false);
  });
});

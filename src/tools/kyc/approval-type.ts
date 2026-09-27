import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { defineApprovalType } from "@/platform/approvals/types";
import { recordAudit } from "@/platform/audit/record";
import { db } from "@/platform/db";

import {
  caseSnapshot,
  DECISION_STATUS,
  findActiveApproval,
  KYC_DECISION_APPROVAL_TYPE,
  kycEntity,
  lockKycCase,
  needsLeadApproval,
  type KycDecision,
} from "./cases";

export type KycDecisionPayload = {
  caseId: string;
  customerName: string;
  decision: KycDecision;
};

/**
 * A reviewer's decision on a case whose risk level needs a compliance lead's
 * sign-off. The platform stops the reviewer from approving their own request.
 */
export const kycDecisionApprovalType = defineApprovalType<KycDecisionPayload>({
  key: KYC_DECISION_APPROVAL_TYPE,
  label: "KYC decision",
  requestPermission: "kyc.review",
  decidePermission: "kyc.decide",
  parse(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload must be an object");
    }
    const { caseId, customerName, decision } = input as Record<string, unknown>;
    if (typeof caseId !== "string" || !caseId) {
      throw new Error("caseId is required");
    }
    if (typeof customerName !== "string" || !customerName) {
      throw new Error("customerName is required");
    }
    if (decision !== "approve" && decision !== "reject") {
      throw new Error("decision must be approve or reject");
    }
    return { caseId, customerName, decision };
  },
  describe: (p) =>
    `${p.decision === "approve" ? "Approve" : "Reject"} KYC case for ${p.customerName}`,
  entity: (p) => kycEntity(p.caseId),
  async checkRequest({ tx, payload }) {
    const kycCase = await lockKycCase(tx, payload.caseId);
    if (!kycCase) return "Case not found";
    if (kycCase.status !== "OPEN") return "This case has already been decided";
    if (!needsLeadApproval(kycCase.riskLevel)) {
      return "This case doesn't need a compliance lead's approval";
    }
    if (await findActiveApproval(tx, kycCase.id)) {
      return "This case is already waiting for a compliance lead";
    }
    return null;
  },
  async execute({ request, payload }) {
    await db.$transaction(async (tx) => {
      const status = await lockRequestStatus(tx, request.id);
      const before = await lockKycCase(tx, payload.caseId);
      if (!before) throw new Error("KYC case not found");
      if (before.approvalRequestId === request.id) return;
      if (status !== "PROCESSING") {
        throw new Error(`Approval request is ${status ?? "missing"}`);
      }
      if (before.status !== "OPEN") {
        throw new Error(`KYC case is already ${before.status}`);
      }
      const approval = await tx.approvalRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
      const decider = await tx.user.findUniqueOrThrow({
        where: { id: request.decidedById },
        select: { id: true, email: true, name: true, role: true },
      });
      const after = await tx.kycCase.update({
        where: { id: before.id },
        data: {
          status: DECISION_STATUS[payload.decision],
          reviewedById: request.requestedById,
          decidedById: request.decidedById,
          decisionReason: approval.requestReason,
          decidedAt: new Date(),
          approvalRequestId: request.id,
        },
      });
      await recordAudit(
        {
          actor: decider,
          action: `kyc.${payload.decision}`,
          entity: kycEntity(before.id),
          before: caseSnapshot(before),
          after: caseSnapshot(after),
          reason: approval.decisionReason ?? approval.requestReason,
        },
        tx,
      );
    });
  },
  async checkOutcome({ request, payload }) {
    // Only called once the request has left PROCESSING, after which execute
    // refuses to apply; the lock waits out an execution already under way.
    return db.$transaction(async (tx) => {
      await lockRequestStatus(tx, request.id);
      const kycCase = await tx.kycCase.findUnique({
        where: { id: payload.caseId },
        select: { approvalRequestId: true },
      });
      return kycCase?.approvalRequestId === request.id ? "completed" : "failed";
    });
  },
});

async function lockRequestStatus(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM approval_requests WHERE id = ${requestId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

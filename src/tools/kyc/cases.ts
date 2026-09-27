import "server-only";

import type { KycCase, KycRiskLevel } from "@/generated/prisma/client";
import { kycLeadApprovalRiskLevels } from "@/platform/config";
import type { DbClient } from "@/platform/db";
import type { Prisma } from "@/generated/prisma/client";

export const KYC_CASE_ENTITY = "KycCase";
export const KYC_DECISION_APPROVAL_TYPE = "kyc.decision";

export const kycEntity = (id: string) => ({ type: KYC_CASE_ENTITY, id });

export type KycDecision = "approve" | "reject";

export const DECISION_STATUS = {
  approve: "APPROVED",
  reject: "REJECTED",
} as const satisfies Record<KycDecision, KycCase["status"]>;

/** Approval requests that still hold the case: nobody may decide it another way meanwhile. */
const ACTIVE_APPROVAL_STATUSES = [
  "PENDING",
  "PROCESSING",
  "OUTCOME_UNKNOWN",
] as const;

export function needsLeadApproval(riskLevel: KycRiskLevel): boolean {
  return kycLeadApprovalRiskLevels().includes(riskLevel);
}

/** Loads the case with a row lock, so decisions on it are made one at a time. */
export async function lockKycCase(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<KycCase | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM kyc_cases WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) return null;
  return tx.kycCase.findUnique({ where: { id } });
}

export function findActiveApproval(client: DbClient, caseId: string) {
  return client.approvalRequest.findFirst({
    where: {
      type: KYC_DECISION_APPROVAL_TYPE,
      entityType: KYC_CASE_ENTITY,
      entityId: caseId,
      status: { in: [...ACTIVE_APPROVAL_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function caseSnapshot(kycCase: KycCase) {
  return {
    status: kycCase.status,
    riskLevel: kycCase.riskLevel,
    reviewedById: kycCase.reviewedById,
    decidedById: kycCase.decidedById,
    decisionReason: kycCase.decisionReason,
    approvalRequestId: kycCase.approvalRequestId,
  };
}

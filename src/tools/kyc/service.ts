import "server-only";

import type { KycCaseStatus, KycRiskLevel } from "@/generated/prisma/enums";
import {
  createApprovalRequest,
  type ApprovalDeps,
} from "@/platform/approvals/service";
import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { getIntegrations, type Integrations } from "@/platform/integrations";
import type { KycCheckResult } from "@/platform/integrations/kyc";
import { authorize } from "@/platform/permissions/guard";
import { hasPermission } from "@/platform/permissions/policy";
import { toSensitiveView } from "@/platform/sensitive/service";
import type { SensitiveView } from "@/platform/sensitive/types";

import {
  caseSnapshot,
  DECISION_STATUS,
  findActiveApproval,
  KYC_CASE_ENTITY,
  KYC_DECISION_APPROVAL_TYPE,
  kycEntity,
  lockKycCase,
  needsLeadApproval,
  type KycDecision,
} from "./cases";

export type KycDeps = {
  integrations?: Integrations;
  approvals?: ApprovalDeps;
};

export type KycResult = { ok: boolean; message: string };

export const KYC_PAGE_SIZE = 25;

export const KYC_STATUSES = ["OPEN", "APPROVED", "REJECTED"] as const;
export const KYC_RISK_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

export type KycFilters = {
  status?: KycCaseStatus;
  risk?: KycRiskLevel;
  page: number;
};

export function parseKycFilters(params: Record<string, unknown>): KycFilters {
  const pick = <T extends string>(options: readonly T[], value: unknown) =>
    options.find((option) => option === value);
  const page = Number(params.page);
  return {
    status: pick(KYC_STATUSES, params.status),
    risk: pick(KYC_RISK_LEVELS, params.risk),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The review queue. Callers must have checked `kyc.view`. */
export async function listKycCases(filters: KycFilters) {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.risk ? { riskLevel: filters.risk } : {}),
  };
  const total = await db.kycCase.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / KYC_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const cases = await db.kycCase.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * KYC_PAGE_SIZE,
    take: KYC_PAGE_SIZE,
    select: {
      id: true,
      customerName: true,
      country: true,
      riskLevel: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });
  const awaiting = await db.approvalRequest.findMany({
    where: {
      type: KYC_DECISION_APPROVAL_TYPE,
      entityType: KYC_CASE_ENTITY,
      entityId: { in: cases.map((c) => c.id) },
      status: { in: ["PENDING", "PROCESSING", "OUTCOME_UNKNOWN"] },
    },
    select: { entityId: true },
  });
  const awaitingIds = new Set(awaiting.map((a) => a.entityId));
  return {
    cases: cases.map((c) => ({
      ...c,
      awaitingLeadApproval: awaitingIds.has(c.id),
    })),
    total,
    page,
    pageCount,
  };
}

export type KycCaseDetail = NonNullable<
  Awaited<ReturnType<typeof getKycCaseDetail>>
>;

/**
 * A case as `viewer` sees it: vendor check results without the raw ID number,
 * which is only reachable through an audited reveal. Callers must have checked `kyc.view`.
 */
export async function getKycCaseDetail(
  viewer: CurrentUser,
  id: string,
  { integrations = getIntegrations() }: KycDeps = {},
) {
  const kycCase = await db.kycCase.findUnique({
    where: { id },
    include: {
      reviewedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
  });
  if (!kycCase) return null;

  let check: Awaited<ReturnType<Integrations["kyc"]["getCheck"]>> = null;
  let vendorUnavailable = false;
  try {
    check = await integrations.kyc.getCheck(kycCase.vendorCheckId);
  } catch {
    vendorUnavailable = true;
  }

  const entity = kycEntity(kycCase.id);
  const activeApproval = await findActiveApproval(db, kycCase.id);
  const approvals = await db.approvalRequest.findMany({
    where: {
      type: KYC_DECISION_APPROVAL_TYPE,
      entityType: KYC_CASE_ENTITY,
      entityId: kycCase.id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
  });

  const idNumber: SensitiveView = toSensitiveView(
    viewer,
    "idNumber",
    entity,
    check?.document.idNumber ?? null,
  );
  const leadApprovalRequired = needsLeadApproval(kycCase.riskLevel);
  return {
    case: kycCase,
    check: check && {
      completedAt: check.completedAt,
      documentType: check.document.type,
      issuingCountry: check.document.issuingCountry,
      expiresOn: check.document.expiresOn,
      documentsUrl: check.documentsUrl,
      results: check.results satisfies KycCheckResult[],
    },
    vendorUnavailable,
    idNumber,
    leadApprovalRequired,
    awaitingLeadApproval: activeApproval != null,
    approvals,
    canDecide:
      kycCase.status === "OPEN" &&
      activeApproval == null &&
      hasPermission(viewer.role, "kyc.review"),
  };
}

/**
 * Approves or rejects a case with a reason. Cases whose risk level needs a
 * compliance lead's sign-off become an approval request instead; everything
 * else is decided here, with its audit entry in the same transaction.
 */
export async function decideKycCase(
  actor: CurrentUser,
  input: { caseId: string; decision: KycDecision; reason: string },
  deps: KycDeps = {},
): Promise<KycResult> {
  const entity = kycEntity(input.caseId);
  const action = `kyc.${input.decision}`;
  const auth = await authorize(actor, "kyc.review", entity);
  if (!auth.ok) return { ok: false, message: "You cannot review KYC cases" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, message: "A reason is required" };

  const kycCase = await db.kycCase.findUnique({ where: { id: input.caseId } });
  if (!kycCase) return { ok: false, message: "Case not found" };

  if (needsLeadApproval(kycCase.riskLevel)) {
    const result = await createApprovalRequest(
      actor,
      {
        type: KYC_DECISION_APPROVAL_TYPE,
        payload: {
          caseId: kycCase.id,
          customerName: kycCase.customerName,
          decision: input.decision,
        },
        reason,
      },
      deps.approvals,
    );
    return result.ok
      ? { ok: true, message: "Sent to a compliance lead for approval" }
      : { ok: false, message: result.error };
  }

  const outcome = await db.$transaction(async (tx) => {
    const before = await lockKycCase(tx, kycCase.id);
    if (!before || before.status !== "OPEN") return "decided" as const;
    if (
      needsLeadApproval(before.riskLevel) ||
      (await findActiveApproval(tx, before.id))
    ) {
      return "awaiting" as const;
    }
    const after = await tx.kycCase.update({
      where: { id: before.id },
      data: {
        status: DECISION_STATUS[input.decision],
        reviewedById: actor.id,
        decidedById: actor.id,
        decisionReason: reason,
        decidedAt: new Date(),
      },
    });
    await recordAudit(
      {
        actor,
        action,
        entity,
        before: caseSnapshot(before),
        after: caseSnapshot(after),
        reason,
      },
      tx,
    );
    return "done" as const;
  });

  if (outcome !== "done") {
    const message =
      outcome === "decided"
        ? "This case has already been decided"
        : "This case is waiting for a compliance lead";
    await recordAudit({
      actor,
      action,
      outcome: "DENIED",
      entity,
      reason: `${message}.`,
    });
    return { ok: false, message };
  }
  return {
    ok: true,
    message: input.decision === "approve" ? "Case approved" : "Case rejected",
  };
}

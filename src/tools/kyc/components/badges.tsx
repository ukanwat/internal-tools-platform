import type { KycCaseStatus, KycRiskLevel } from "@/generated/prisma/enums";
import type { KycResultOutcome } from "@/platform/integrations/kyc";
import { StatusBadge, type StatusTone } from "@/platform/ui";

const RISK: Record<KycRiskLevel, { label: string; tone: StatusTone }> = {
  LOW: { label: "Low risk", tone: "neutral" },
  MEDIUM: { label: "Medium risk", tone: "warning" },
  HIGH: { label: "High risk", tone: "danger" },
};

export const KYC_RISK_LABELS: Record<KycRiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const KYC_STATUS_LABELS: Record<KycCaseStatus, string> = {
  OPEN: "Open",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_TONES: Record<KycCaseStatus, StatusTone> = {
  OPEN: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

const OUTCOMES: Record<KycResultOutcome, { label: string; tone: StatusTone }> =
  {
    clear: { label: "Clear", tone: "success" },
    consider: { label: "Consider", tone: "warning" },
    fail: { label: "Fail", tone: "danger" },
  };

export function KycRiskBadge({ risk }: { risk: KycRiskLevel }) {
  return <StatusBadge tone={RISK[risk].tone}>{RISK[risk].label}</StatusBadge>;
}

export function KycStatusBadge({
  status,
  awaitingLeadApproval,
}: {
  status: KycCaseStatus;
  awaitingLeadApproval: boolean;
}) {
  if (status === "OPEN" && awaitingLeadApproval) {
    return <StatusBadge tone="warning">Waiting for lead</StatusBadge>;
  }
  return (
    <StatusBadge tone={STATUS_TONES[status]}>
      {KYC_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function KycOutcomeBadge({ outcome }: { outcome: KycResultOutcome }) {
  return (
    <StatusBadge tone={OUTCOMES[outcome].tone}>
      {OUTCOMES[outcome].label}
    </StatusBadge>
  );
}

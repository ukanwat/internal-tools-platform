import type { AuditOutcome } from "@/generated/prisma/enums";

import { StatusBadge, type StatusTone } from "./status-badge";

const OUTCOMES: Record<AuditOutcome, { label: string; tone: StatusTone }> = {
  SUCCESS: { label: "Success", tone: "success" },
  DENIED: { label: "Denied", tone: "danger" },
  FAILURE: { label: "Failure", tone: "warning" },
};

export const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  SUCCESS: OUTCOMES.SUCCESS.label,
  DENIED: OUTCOMES.DENIED.label,
  FAILURE: OUTCOMES.FAILURE.label,
};

export function AuditOutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const { label, tone } = OUTCOMES[outcome];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

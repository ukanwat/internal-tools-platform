import type { ApprovalStatus } from "@/generated/prisma/enums";
import { StatusBadge, type StatusTone } from "@/platform/ui";

const STATUSES: Record<ApprovalStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  PROCESSING: { label: "Processing", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { label, tone } = STATUSES[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

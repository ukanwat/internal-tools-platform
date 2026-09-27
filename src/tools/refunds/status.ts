import type { ApprovalStatus, RefundStatus } from "@/generated/prisma/enums";
import type { StatusTone } from "@/platform/ui/status-badge";

export type RefundState =
  "AWAITING_APPROVAL" | "PROCESSING" | "PAID" | "FAILED" | "REJECTED";

export const REFUND_STATES: readonly RefundState[] = [
  "AWAITING_APPROVAL",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REJECTED",
];

export const REFUND_STATE_LABELS: Record<RefundState, string> = {
  AWAITING_APPROVAL: "Awaiting approval",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

export const REFUND_STATE_TONES: Record<RefundState, StatusTone> = {
  AWAITING_APPROVAL: "warning",
  PROCESSING: "info",
  PAID: "success",
  FAILED: "danger",
  REJECTED: "neutral",
};

const FROM_APPROVAL: Record<ApprovalStatus, RefundState> = {
  PENDING: "AWAITING_APPROVAL",
  PROCESSING: "PROCESSING",
  OUTCOME_UNKNOWN: "PROCESSING",
  COMPLETED: "PAID",
  REJECTED: "REJECTED",
};

/**
 * A refund paid straight away carries its own status; one that needed approval
 * takes it from its approval request.
 */
export function refundState(
  status: RefundStatus | null,
  approvalStatus: ApprovalStatus | null,
): RefundState {
  if (approvalStatus) return FROM_APPROVAL[approvalStatus];
  return status ?? "PROCESSING";
}

/** Direct and approval statuses that make up each state, for filtering. */
export function statusesFor(state: RefundState): {
  direct: RefundStatus[];
  approval: ApprovalStatus[];
} {
  return {
    direct:
      state === "AWAITING_APPROVAL" || state === "REJECTED" ? [] : [state],
    approval: (Object.keys(FROM_APPROVAL) as ApprovalStatus[]).filter(
      (s) => FROM_APPROVAL[s] === state,
    ),
  };
}

/** Refunds in these states no longer count against what's left to refund. */
export function releasesAmount(state: RefundState): boolean {
  return state === "FAILED" || state === "REJECTED";
}

export function parseRefundState(value: unknown): RefundState | undefined {
  return typeof value === "string" &&
    (REFUND_STATES as readonly string[]).includes(value)
    ? (value as RefundState)
    : undefined;
}

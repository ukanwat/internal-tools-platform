import { StatusBadge } from "@/platform/ui/status-badge";

import {
  REFUND_STATE_LABELS,
  REFUND_STATE_TONES,
  type RefundState,
} from "../status";

export function RefundStateBadge({ state }: { state: RefundState }) {
  return (
    <StatusBadge tone={REFUND_STATE_TONES[state]}>
      {REFUND_STATE_LABELS[state]}
    </StatusBadge>
  );
}

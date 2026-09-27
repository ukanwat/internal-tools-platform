import { ROLE_LABELS } from "@/platform/permissions/roles";
import { formatTimestamp } from "@/platform/ui";
import { RecordHistory } from "@/platform/ui/record-history";

import type { ApprovalListItem } from "../query";
import { ApprovalStatusBadge } from "./approval-status-badge";
import { DecisionForm } from "./decision-form";

export function ApprovalsList({ requests }: { requests: ApprovalListItem[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Nothing here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {requests.map((request) => (
        <li
          key={request.id}
          className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_20rem]"
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ApprovalStatusBadge status={request.status} />
              <span className="text-muted-foreground text-xs">
                {request.typeLabel}
              </span>
            </div>
            <p className="font-medium">{request.summary}</p>
            <p>
              Requested by {request.requestedBy.name} (
              {ROLE_LABELS[request.requestedBy.role]}) on{" "}
              {formatTimestamp(request.createdAt)}
            </p>
            <p className="text-muted-foreground whitespace-pre-wrap">
              Why: {request.requestReason}
            </p>
            {request.decidedBy && (
              <p>
                Decided by {request.decidedBy.name}
                {request.decisionReason && `: ${request.decisionReason}`}
              </p>
            )}
            {request.lastError && (
              <p className="text-destructive">
                Last attempt failed: {request.lastError}
              </p>
            )}
            <details>
              <summary className="cursor-pointer text-xs">History</summary>
              <div className="mt-2">
                <RecordHistory
                  entityType="ApprovalRequest"
                  entityId={request.id}
                />
              </div>
            </details>
          </div>
          {request.canDecide && <DecisionForm requestId={request.id} />}
        </li>
      ))}
    </ul>
  );
}

import { InboxIcon, TriangleAlertIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CurrentUser } from "@/platform/auth/types";
import { ROLE_LABELS } from "@/platform/permissions/roles";
import { LocalTime } from "@/platform/ui/local-time";
import { RecordHistory } from "@/platform/ui/record-history";

import type { ApprovalListItem } from "../query";
import { ApprovalStatusBadge } from "./approval-status-badge";
import { DecisionButtons } from "./decision-buttons";

export function ApprovalsList({
  requests,
  viewer,
}: {
  requests: ApprovalListItem[];
  viewer: CurrentUser;
}) {
  if (requests.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm">
        <InboxIcon className="size-8" />
        <p>Nothing here right now.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {requests.map((request) => (
        <li key={request.id}>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalStatusBadge status={request.status} />
                <span className="text-muted-foreground text-xs">
                  {request.typeLabel}
                </span>
              </div>
              <CardTitle>{request.summary}</CardTitle>
              <CardDescription>
                Requested by {request.requestedBy.name} (
                {ROLE_LABELS[request.requestedBy.role]}) ·{" "}
                <LocalTime date={request.createdAt} />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Quote label="Reason">{request.requestReason}</Quote>
              {request.decidedBy && (
                <Quote label={`Decided by ${request.decidedBy.name}`}>
                  {request.decisionReason}
                </Quote>
              )}
              {request.status === "PENDING" && request.lastError && (
                <p className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-lg p-3">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                  {request.lastError}
                </p>
              )}
              <details className="group">
                <summary className="text-primary cursor-pointer text-sm font-medium">
                  History
                </summary>
                <div className="mt-3">
                  <RecordHistory
                    viewer={viewer}
                    entityType="ApprovalRequest"
                    entityId={request.id}
                  />
                </div>
              </details>
            </CardContent>
            {request.canDecide && (
              <CardFooter className="justify-end">
                <DecisionButtons
                  requestId={request.id}
                  summary={request.summary}
                />
              </CardFooter>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Quote({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children && <p className="whitespace-pre-wrap">{children}</p>}
    </div>
  );
}

import { ClockIcon, FlagIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApprovalStatusBadge } from "@/platform/approvals/components/approval-status-badge";
import type { CurrentUser } from "@/platform/auth/types";
import { hasPermission } from "@/platform/permissions/policy";
import { LocalTime } from "@/platform/ui/local-time";
import { RecordHistory } from "@/platform/ui/record-history";
import { StatusBadge } from "@/platform/ui/status-badge";

import { ENVIRONMENT_LABELS } from "../rules";
import type { listFlags } from "../service";
import { ChangeFlagDialog } from "./change-flag-dialog";
import { TurnOffDialog } from "./turn-off-dialog";

type Flag = Awaited<ReturnType<typeof listFlags>>[number];
type FlagState = Flag["states"][number];

export function FlagList({
  flags,
  viewer,
}: {
  flags: Flag[];
  viewer: CurrentUser;
}) {
  if (flags.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm">
        <FlagIcon className="size-8" />
        <p>No feature flags yet.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {flags.map((flag) => (
        <li key={flag.id}>
          <Card>
            <CardHeader>
              <CardTitle className="font-mono">{flag.key}</CardTitle>
              <CardDescription>{flag.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {flag.states.map((state) => (
                <StateRow
                  key={state.id}
                  flagKey={flag.key}
                  state={state}
                  viewer={viewer}
                />
              ))}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function StateRow({
  flagKey,
  state,
  viewer,
}: {
  flagKey: string;
  state: FlagState;
  viewer: CurrentUser;
}) {
  const production = state.environment === "PRODUCTION";
  const canChange = production
    ? hasPermission(viewer.role, "flags.request_production") ||
      hasPermission(viewer.role, "flags.reduce_production")
    : hasPermission(viewer.role, "flags.change_staging");
  const canTurnOff = hasPermission(
    viewer.role,
    production ? "flags.reduce_production" : "flags.change_staging",
  );

  return (
    <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {ENVIRONMENT_LABELS[state.environment]}
            </span>
            {state.enabled ? (
              <StatusBadge tone="success">
                On · {state.rolloutPercent}%
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Off</StatusBadge>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {state.updatedBy
              ? `Last changed by ${state.updatedBy.name} · `
              : ""}
            <LocalTime date={state.updatedAt} />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canChange && (
            <ChangeFlagDialog
              stateId={state.id}
              version={state.version}
              flagKey={flagKey}
              environment={state.environment}
              current={{
                enabled: state.enabled,
                rolloutPercent: state.rolloutPercent,
              }}
            />
          )}
          {canTurnOff && state.enabled && (
            <TurnOffDialog
              stateId={state.id}
              flagKey={flagKey}
              environment={state.environment}
            />
          )}
        </div>
      </div>
      {state.openRequests.map((request) => (
        <Link
          key={request.id}
          href="/approvals?tab=all"
          className="bg-muted/50 hover:bg-muted flex flex-wrap items-start gap-2 rounded-lg p-3 text-sm"
        >
          {request.stale ? (
            <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />
          ) : (
            <ClockIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span>{request.summary}</span>
            <span className="text-muted-foreground text-xs">
              Requested by {request.requestedBy} ·{" "}
              <LocalTime date={request.createdAt} />
              {request.stale &&
                " · The flag changed since this was requested, so it can't be applied. Reject it and request again."}
            </span>
          </span>
          <ApprovalStatusBadge status={request.status} />
        </Link>
      ))}
      <details>
        <summary className="text-primary cursor-pointer text-sm font-medium">
          History
        </summary>
        <div className="mt-3">
          <RecordHistory
            viewer={viewer}
            entityType="FeatureFlagState"
            entityId={state.id}
          />
        </div>
      </details>
    </section>
  );
}

import "server-only";

import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { hasPermission } from "@/platform/permissions/policy";
import { ROLE_LABELS } from "@/platform/permissions/roles";

import { formatTimestamp } from "./format";
import { AuditOutcomeBadge } from "./outcome-badge";

type Props = {
  viewer: CurrentUser;
  entityType: string;
  entityId: string;
};

/**
 * A record's audit trail as `viewer` may see it. Without `audit.view`, denied
 * attempts are left out and failure reasons (which can hold raw integration
 * errors) are hidden.
 */
export async function listRecordHistory({
  viewer,
  entityType,
  entityId,
}: Props) {
  const fullAccess = hasPermission(viewer.role, "audit.view");
  const entries = await db.auditLog.findMany({
    where: {
      entityType,
      entityId,
      ...(fullAccess ? {} : { outcome: { not: "DENIED" } }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actor: { select: { name: true } } },
  });
  return fullAccess
    ? entries
    : entries.map((entry) =>
        entry.outcome === "FAILURE" ? { ...entry, reason: null } : entry,
      );
}

/**
 * A record's audit trail. Only render it on pages that already checked the
 * viewer may see this record.
 */
export async function RecordHistory(props: Props) {
  const entries = await listRecordHistory(props);

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No history yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3 border-l pl-4 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{entry.action}</span>
            <AuditOutcomeBadge outcome={entry.outcome} />
            <span>
              {entry.actor?.name ?? "System"}
              {entry.actorRole && (
                <span className="text-muted-foreground">
                  {" "}
                  ({ROLE_LABELS[entry.actorRole]})
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatTimestamp(entry.createdAt)}
            </span>
          </div>
          {entry.reason && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {entry.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

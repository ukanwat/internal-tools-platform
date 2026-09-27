import "server-only";

import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { hasPermission } from "@/platform/permissions/policy";
import { describeAction, describeReason } from "@/platform/audit/labels";
import { ROLE_LABELS } from "@/platform/permissions/roles";

import { LocalTime } from "./local-time";
import { AuditOutcomeBadge } from "./outcome-badge";

type Props = {
  viewer: CurrentUser;
  entityType: string;
  entityId: string;
  /** Other records whose entries belong in the same timeline, e.g. a linked approval request. */
  related?: { type: string; id: string }[];
};

/**
 * A record's audit trail as `viewer` may see it. Without `audit.view`, denied
 * attempts are left out and failure reasons (which can hold raw integration
 * errors) and before/after snapshots are hidden.
 */
export async function listRecordHistory({
  viewer,
  entityType,
  entityId,
  related = [],
}: Props) {
  const fullAccess = hasPermission(viewer.role, "audit.view");
  const records = [{ type: entityType, id: entityId }, ...related];
  const entries = await db.auditLog.findMany({
    where: {
      OR: records.map((r) => ({ entityType: r.type, entityId: r.id })),
      ...(fullAccess ? {} : { outcome: { not: "DENIED" } }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actor: { select: { name: true } } },
  });
  return fullAccess
    ? entries
    : entries.map((entry) => ({
        ...entry,
        before: null,
        after: null,
        reason: entry.outcome === "FAILURE" ? null : entry.reason,
      }));
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
    <ol className="relative flex flex-col gap-4 border-l pl-5 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex flex-col gap-1">
          <span className="bg-primary ring-background absolute top-1.5 -left-[25px] size-2 rounded-full ring-4" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium" title={entry.action}>
              {describeAction(entry.action)}
            </span>
            <AuditOutcomeBadge outcome={entry.outcome} />
          </div>
          <div className="text-muted-foreground text-xs">
            {entry.actor?.name ?? "System"}
            {entry.actorRole && ` (${ROLE_LABELS[entry.actorRole]})`} ·{" "}
            <LocalTime date={entry.createdAt} />
          </div>
          {entry.reason && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {describeReason(entry.reason)}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

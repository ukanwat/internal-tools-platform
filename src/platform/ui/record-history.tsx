import "server-only";

import { db } from "@/platform/db";
import { ROLE_LABELS } from "@/platform/permissions/roles";

import { formatTimestamp } from "./format";
import { AuditOutcomeBadge } from "./outcome-badge";

type Props = {
  entityType: string;
  entityId: string;
};

/**
 * A record's audit trail. Only render it on pages that already checked the
 * viewer may see this record.
 */
export async function RecordHistory({ entityType, entityId }: Props) {
  const entries = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actor: { select: { name: true } } },
  });

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

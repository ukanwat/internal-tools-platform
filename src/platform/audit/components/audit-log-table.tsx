import type { AuditOutcome, Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/platform/permissions/roles";
import {
  AuditOutcomeBadge,
  DataTable,
  type DataTableColumn,
} from "@/platform/ui";
import { LocalTime } from "@/platform/ui/local-time";

import { describeAction, describeEntityType } from "../labels";

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  actor: { name: string; email: string } | null;
  actorRole: Role | null;
  action: string;
  outcome: AuditOutcome;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
};

function columns(
  recordNames: Record<string, string>,
): DataTableColumn<AuditLogRow>[] {
  return [
    {
      header: "When",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (entry) => <LocalTime date={entry.createdAt} />,
    },
    {
      header: "Who",
      cell: (entry) =>
        entry.actor ? (
          <div className="flex flex-col">
            <span className="font-medium">{entry.actor.name}</span>
            <span className="text-muted-foreground text-xs">
              {entry.actorRole ? ROLE_LABELS[entry.actorRole] : null}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Anonymous</span>
        ),
    },
    {
      header: "What",
      cell: (entry) => (
        <div className="flex flex-col items-start gap-1">
          <span title={entry.action}>{describeAction(entry.action)}</span>
          <AuditOutcomeBadge outcome={entry.outcome} />
        </div>
      ),
    },
    {
      header: "Record",
      className: "max-w-64 whitespace-normal",
      cell: (entry) =>
        entry.entityType && entry.entityId ? (
          <div className="flex flex-col">
            <span title={entry.entityId}>
              {recordNames[`${entry.entityType}:${entry.entityId}`] ??
                entry.entityId}
            </span>
            <span className="text-muted-foreground text-xs">
              {describeEntityType(entry.entityType)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Why",
      className: "max-w-xs whitespace-normal",
      cell: (entry) =>
        entry.reason ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Details",
      cell: (entry) => (
        <ChangeDetails before={entry.before} after={entry.after} />
      ),
    },
  ];
}

export function AuditLogTable({
  entries,
  recordNames = {},
}: {
  entries: AuditLogRow[];
  recordNames?: Record<string, string>;
}) {
  return (
    <DataTable
      columns={columns(recordNames)}
      rows={entries}
      rowKey={(entry) => entry.id}
      empty="No audit entries match these filters."
    />
  );
}

function ChangeDetails({ before, after }: { before: unknown; after: unknown }) {
  if (before == null && after == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <details className="text-xs">
      <summary className="text-primary cursor-pointer">View change</summary>
      <div className="mt-2 grid gap-2">
        <JsonBlock label="Before" value={before} />
        <JsonBlock label="After" value={after} />
      </div>
    </details>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 font-medium">{label}</div>
      <pre className="bg-muted max-w-sm overflow-x-auto rounded-md p-2">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

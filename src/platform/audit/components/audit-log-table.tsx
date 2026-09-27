import type { AuditOutcome, Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/platform/permissions/roles";
import {
  AuditOutcomeBadge,
  DataTable,
  type DataTableColumn,
} from "@/platform/ui";

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

const COLUMNS: DataTableColumn<AuditLogRow>[] = [
  {
    header: "When (UTC)",
    className: "font-mono text-xs",
    cell: (entry) =>
      entry.createdAt.toISOString().replace("T", " ").slice(0, 19),
  },
  {
    header: "Who",
    cell: (entry) =>
      entry.actor ? (
        <div className="flex flex-col">
          <span>{entry.actor.name}</span>
          <span className="text-muted-foreground text-xs">
            {entry.actorRole ? ROLE_LABELS[entry.actorRole] : null}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">Anonymous</span>
      ),
  },
  {
    header: "Action",
    className: "font-mono text-xs",
    cell: (entry) => entry.action,
  },
  {
    header: "Record",
    className: "font-mono text-xs",
    cell: (entry) =>
      entry.entityType ? `${entry.entityType}:${entry.entityId}` : "—",
  },
  {
    header: "Outcome",
    cell: (entry) => <AuditOutcomeBadge outcome={entry.outcome} />,
  },
  {
    header: "Why",
    className: "max-w-xs text-sm whitespace-normal",
    cell: (entry) => entry.reason ?? "—",
  },
  {
    header: "Change",
    cell: (entry) => (
      <ChangeDetails before={entry.before} after={entry.after} />
    ),
  },
];

export function AuditLogTable({ entries }: { entries: AuditLogRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
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
      <summary className="cursor-pointer">View</summary>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
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
      <pre className="bg-muted max-w-sm overflow-x-auto rounded p-2">
        {value == null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

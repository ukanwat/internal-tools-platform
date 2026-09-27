import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditOutcome, Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/platform/permissions/roles";

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

export function AuditLogTable({ entries }: { entries: AuditLogRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No audit entries match these filters.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When (UTC)</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Record</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Why</TableHead>
          <TableHead>Change</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} className="align-top">
            <TableCell className="font-mono text-xs">
              {entry.createdAt.toISOString().replace("T", " ").slice(0, 19)}
            </TableCell>
            <TableCell>
              {entry.actor ? (
                <div className="flex flex-col">
                  <span>{entry.actor.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {entry.actorRole ? ROLE_LABELS[entry.actorRole] : null}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Anonymous</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">{entry.action}</TableCell>
            <TableCell className="font-mono text-xs">
              {entry.entityType ? `${entry.entityType}:${entry.entityId}` : "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  entry.outcome === "DENIED" ? "destructive" : "secondary"
                }
              >
                {entry.outcome === "DENIED" ? "Denied" : "Success"}
              </Badge>
            </TableCell>
            <TableCell className="max-w-xs text-sm whitespace-normal">
              {entry.reason ?? "—"}
            </TableCell>
            <TableCell>
              <ChangeDetails before={entry.before} after={entry.after} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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

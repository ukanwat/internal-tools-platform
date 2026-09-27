import Link from "next/link";

import { getAuditFilterOptions, listAuditEntries } from "@/platform/audit";
import { AuditFilters } from "@/platform/audit/components/audit-filters";
import { AuditLogTable } from "@/platform/audit/components/audit-log-table";
import {
  auditFiltersToQuery,
  parseAuditFilters,
} from "@/platform/audit/filters";
import { requirePermission } from "@/platform/permissions";

const BASE_PATH = "/admin/audit";

export default async function AuditLogPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  await requirePermission("audit.view");

  const filters = parseAuditFilters(await searchParams);
  const [{ entries, total, page, pageCount }, options] = await Promise.all([
    listAuditEntries(filters),
    getAuditFilterOptions(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? "entry" : "entries"}
        </p>
      </div>
      <AuditFilters
        basePath={BASE_PATH}
        actors={options.actors}
        actions={options.actions}
        selected={filters}
      />
      <AuditLogTable entries={entries} />
      {pageCount > 1 && (
        <nav className="flex items-center gap-4 text-sm">
          {page > 1 && (
            <Link
              href={`${BASE_PATH}${auditFiltersToQuery({ ...filters, page: page - 1 })}`}
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link
              href={`${BASE_PATH}${auditFiltersToQuery({ ...filters, page: page + 1 })}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}

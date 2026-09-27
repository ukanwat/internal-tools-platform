import { getAuditFilterOptions, listAuditEntries } from "@/platform/audit";
import { AuditFilters } from "@/platform/audit/components/audit-filters";
import { AuditLogTable } from "@/platform/audit/components/audit-log-table";
import {
  auditFiltersToQuery,
  parseAuditFilters,
} from "@/platform/audit/filters";
import { requirePermission } from "@/platform/permissions";
import { PageHeader, Pagination } from "@/platform/ui";

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
      <PageHeader
        title="Audit log"
        description={`${total} ${total === 1 ? "entry" : "entries"}`}
      />
      <AuditFilters
        key={auditFiltersToQuery({ ...filters, page: 1 })}
        basePath={BASE_PATH}
        actors={options.actors}
        actions={options.actions}
        selected={filters}
      />
      <AuditLogTable entries={entries} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) =>
          `${BASE_PATH}${auditFiltersToQuery({ ...filters, page: p })}`
        }
      />
    </main>
  );
}

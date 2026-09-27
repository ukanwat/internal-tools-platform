import type { Metadata } from "next";

import { getAuditFilterOptions, listAuditEntries } from "@/platform/audit";
import { AuditFilters } from "@/platform/audit/components/audit-filters";
import { AuditLogTable } from "@/platform/audit/components/audit-log-table";
import {
  auditFiltersToQuery,
  parseAuditFilters,
  shouldHideSignIns,
} from "@/platform/audit/filters";
import { resolveRecordNames } from "@/platform/audit/record-names";
import { requirePermission } from "@/platform/permissions";
import { PageHeader, Pagination } from "@/platform/ui";
import { PageBody } from "@/platform/ui/page";

const BASE_PATH = "/admin/audit";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  await requirePermission("audit.view");

  const filters = parseAuditFilters(await searchParams);
  const [{ entries, total, page, pageCount }, options] = await Promise.all([
    listAuditEntries({ ...filters, hideSignIns: shouldHideSignIns(filters) }),
    getAuditFilterOptions(),
  ]);
  const recordNames = await resolveRecordNames(entries);

  return (
    <PageBody>
      <PageHeader
        title="Audit log"
        description={`Every action and blocked attempt across the platform. ${total} ${total === 1 ? "entry" : "entries"}${shouldHideSignIns(filters) ? ", sign-ins hidden" : ""}.`}
      />
      <AuditFilters
        key={auditFiltersToQuery({ ...filters, page: 1 })}
        basePath={BASE_PATH}
        actors={options.actors}
        actions={options.actions}
        selected={filters}
      />
      <div className="bg-card rounded-xl border">
        <AuditLogTable entries={entries} recordNames={recordNames} />
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) =>
          `${BASE_PATH}${auditFiltersToQuery({ ...filters, page: p })}`
        }
      />
    </PageBody>
  );
}

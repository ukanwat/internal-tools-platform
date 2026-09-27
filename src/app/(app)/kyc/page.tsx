import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/platform/permissions/guard";
import {
  DataTable,
  FilterBar,
  LocalTime,
  PageBody,
  PageHeader,
  Pagination,
} from "@/platform/ui";
import {
  KYC_RISK_LABELS,
  KYC_STATUS_LABELS,
  KycRiskBadge,
  KycStatusBadge,
} from "@/tools/kyc/components/badges";
import {
  KYC_RISK_LEVELS,
  KYC_STATUSES,
  listKycCases,
  parseKycFilters,
} from "@/tools/kyc/service";

export const metadata: Metadata = { title: "KYC review" };

export default async function KycQueuePage({
  searchParams,
}: PageProps<"/kyc">) {
  await requirePermission("kyc.view");
  const params = await searchParams;
  const filters = parseKycFilters({ status: "OPEN", ...params });
  const { cases, page, pageCount } = await listKycCases(filters);

  const query = (p: number) =>
    new URLSearchParams({
      status: filters.status ?? "",
      risk: filters.risk ?? "",
      page: String(p),
    }).toString();

  return (
    <PageBody>
      <PageHeader
        title="KYC review"
        description="Identity checks from the KYC vendor waiting for a decision. High-risk cases also need a compliance lead's approval."
      />
      <FilterBar
        key={`${filters.status}-${filters.risk}`}
        basePath="/kyc"
        fields={[
          {
            name: "status",
            label: "Status",
            anyLabel: "Any status",
            value: filters.status,
            options: KYC_STATUSES.map((s) => ({
              value: s,
              label: KYC_STATUS_LABELS[s],
            })),
          },
          {
            name: "risk",
            label: "Risk",
            anyLabel: "Any risk",
            value: filters.risk,
            options: KYC_RISK_LEVELS.map((r) => ({
              value: r,
              label: KYC_RISK_LABELS[r],
            })),
          },
        ]}
      />
      <DataTable
        rows={cases}
        rowKey={(c) => c.id}
        empty="No cases match these filters."
        columns={[
          {
            header: "Customer",
            cell: (c) => (
              <Link
                href={`/kyc/${c.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {c.customerName}
              </Link>
            ),
          },
          { header: "Country", cell: (c) => c.country },
          { header: "Risk", cell: (c) => <KycRiskBadge risk={c.riskLevel} /> },
          {
            header: "Status",
            cell: (c) => (
              <KycStatusBadge
                status={c.status}
                awaitingLeadApproval={c.awaitingLeadApproval}
              />
            ),
          },
          {
            header: "Opened",
            cell: (c) => <LocalTime date={c.createdAt} />,
            className: "text-muted-foreground text-xs",
          },
        ]}
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => `/kyc?${query(p)}`}
      />
    </PageBody>
  );
}

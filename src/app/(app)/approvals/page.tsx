import {
  approvalRegistry,
  failStaleApprovals,
  listApprovals,
  parseApprovalTab,
} from "@/platform/approvals";
import { ApprovalsList } from "@/platform/approvals/components/approvals-list";
import { requireUser } from "@/platform/auth";
import { LinkTabs, PageHeader, Pagination } from "@/platform/ui";

const TAB_LABELS = {
  waiting: "Waiting for me",
  all: "All",
  mine: "Mine",
} as const;

export default async function ApprovalsPage({
  searchParams,
}: PageProps<"/approvals">) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseApprovalTab(params.tab);
  const requestedPage = Number(params.page);

  await failStaleApprovals();
  const { requests, counts, page, pageCount } = await listApprovals(
    user,
    tab,
    approvalRegistry,
    Number.isInteger(requestedPage) ? requestedPage : 1,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <PageHeader
        title="Approvals"
        description="Requests you made or can decide."
      />
      <LinkTabs
        tabs={(["waiting", "all", "mine"] as const).map((t) => ({
          href: `/approvals?tab=${t}`,
          label: TAB_LABELS[t],
          count: counts[t],
          active: t === tab,
        }))}
      />
      <ApprovalsList requests={requests} />
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => `/approvals?tab=${tab}&page=${p}`}
      />
    </main>
  );
}

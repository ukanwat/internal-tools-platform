import {
  failStaleApprovals,
  listApprovals,
  parseApprovalTab,
} from "@/platform/approvals";
import { ApprovalsList } from "@/platform/approvals/components/approvals-list";
import { requireUser } from "@/platform/auth";
import { LinkTabs, PageHeader } from "@/platform/ui";

const TAB_LABELS = {
  waiting: "Waiting for me",
  all: "All",
  mine: "Mine",
} as const;

export default async function ApprovalsPage({
  searchParams,
}: PageProps<"/approvals">) {
  const user = await requireUser();
  const tab = parseApprovalTab((await searchParams).tab);

  await failStaleApprovals();
  const { requests, counts } = await listApprovals(user, tab);

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
    </main>
  );
}

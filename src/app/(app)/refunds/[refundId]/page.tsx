import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { settleApprovals } from "@/platform/approvals";
import { requirePermission, ROLE_LABELS } from "@/platform/permissions";
import { SensitiveValue } from "@/platform/sensitive/components/sensitive-value";
import { PageBody, PageHeader } from "@/platform/ui";
import { LocalTime } from "@/platform/ui/local-time";
import { RecordHistory } from "@/platform/ui/record-history";
import { DetailList } from "@/tools/refunds/components/detail-list";
import { RefundStateBadge } from "@/tools/refunds/components/refund-state-badge";
import { formatMoney } from "@/tools/refunds/money";
import { getRefund } from "@/tools/refunds/query";
import { settleRefunds } from "@/tools/refunds/service";

export const metadata: Metadata = { title: "Refund" };

export default async function RefundPage({
  params,
}: PageProps<"/refunds/[refundId]">) {
  const { refundId } = await params;
  const viewer = await requirePermission("refunds.view", {
    type: "Refund",
    id: refundId,
  });
  await Promise.all([settleRefunds(), settleApprovals()]);
  const data = await getRefund(viewer, refundId);
  if (!data) notFound();
  const { refund, approval } = data;
  const money = formatMoney(refund.amountMinor, refund.currency);
  const error = approval ? approval.lastError : refund.lastError;
  const showError =
    error &&
    (refund.state === "FAILED" ||
      refund.state === "AWAITING_APPROVAL" ||
      refund.state === "PROCESSING");

  return (
    <PageBody>
      <PageHeader
        title={`Refund of ${money}`}
        description={
          <Link href="/refunds" className="hover:underline">
            ← Back to refunds
          </Link>
        }
        actions={
          approval?.status === "PENDING" ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/approvals?tab=all" />}
            >
              Open approvals
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <RefundStateBadge state={refund.state} />
            </div>
            <CardTitle>Refund details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {showError && (
              <p className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-lg p-3 text-sm">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
            <DetailList
              items={[
                { label: "Amount", value: money },
                {
                  label: "Order",
                  value: (
                    <Link
                      href={`/refunds/orders/${refund.order.id}`}
                      className="text-primary hover:underline"
                    >
                      {refund.order.number}
                    </Link>
                  ),
                },
                { label: "Customer", value: refund.order.customerName },
                {
                  label: "Paid to",
                  value: <SensitiveValue view={refund.order.accountNumber} />,
                },
                {
                  label: "Requested by",
                  value: `${refund.requestedBy.name} (${ROLE_LABELS[refund.requestedBy.role]})`,
                },
                {
                  label: "Requested",
                  value: <LocalTime date={refund.createdAt} />,
                },
                {
                  label: "Reason",
                  value: (
                    <span className="whitespace-pre-wrap">{refund.reason}</span>
                  ),
                },
                {
                  label: "Paid",
                  value: refund.paidAt ? (
                    <LocalTime date={refund.paidAt} />
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
            <CardDescription>
              {approval
                ? "Over the approval limit, so finance had to sign off."
                : "Within the approval limit, so it was paid straight away."}
            </CardDescription>
          </CardHeader>
          {approval && (
            <CardContent>
              <DetailList
                items={[
                  {
                    label: "Decided by",
                    value: approval.decidedBy
                      ? `${approval.decidedBy.name} (${ROLE_LABELS[approval.decidedBy.role]})`
                      : "Waiting for finance",
                  },
                  {
                    label: "Decided",
                    value: approval.decidedAt ? (
                      <LocalTime date={approval.decidedAt} />
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Decision reason",
                    value: approval.decisionReason ?? "—",
                  },
                ]}
              />
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Everything that happened to this refund, including its approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordHistory
            viewer={viewer}
            entityType="Refund"
            entityId={refund.id}
            related={
              approval ? [{ type: "ApprovalRequest", id: approval.id }] : []
            }
          />
        </CardContent>
      </Card>
    </PageBody>
  );
}

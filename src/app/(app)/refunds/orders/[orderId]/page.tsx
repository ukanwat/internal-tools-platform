import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { refundApprovalThresholdMinor } from "@/platform/config";
import { hasPermission, requirePermission } from "@/platform/permissions";
import { SensitiveValue } from "@/platform/sensitive/components/sensitive-value";
import { DataTable, PageBody, PageHeader } from "@/platform/ui";
import { LocalTime } from "@/platform/ui/local-time";
import { RecordHistory } from "@/platform/ui/record-history";
import { DetailList } from "@/tools/refunds/components/detail-list";
import { RefundForm } from "@/tools/refunds/components/refund-form";
import { RefundStateBadge } from "@/tools/refunds/components/refund-state-badge";
import { formatMoney } from "@/tools/refunds/money";
import { getOrder } from "@/tools/refunds/query";
import { settleRefunds } from "@/tools/refunds/service";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({
  params,
}: PageProps<"/refunds/orders/[orderId]">) {
  const { orderId } = await params;
  const viewer = await requirePermission("refunds.view", {
    type: "Order",
    id: orderId,
  });
  await settleRefunds();
  const data = await getOrder(viewer, orderId);
  if (!data) notFound();
  const { order, refunds, remainingMinor } = data;
  const canRequest = hasPermission(viewer.role, "refunds.request");

  return (
    <PageBody>
      <PageHeader
        title={`Order ${order.number}`}
        description={
          <Link href="/refunds" className="hover:underline">
            ← Back to refunds
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Customer", value: order.customerName },
                { label: "Email", value: order.customerEmail },
                {
                  label: "Amount",
                  value: formatMoney(order.amountMinor, order.currency),
                },
                {
                  label: "Left to refund",
                  value: formatMoney(remainingMinor, order.currency),
                },
                { label: "Placed", value: <LocalTime date={order.placedAt} /> },
                {
                  label: "Payment",
                  value: <span className="font-mono">{order.paymentId}</span>,
                },
                {
                  label: "Refund account",
                  value: <SensitiveValue view={order.accountNumber} />,
                },
              ]}
            />
          </CardContent>
        </Card>

        {canRequest && (
          <Card>
            <CardHeader>
              <CardTitle>Refund this order</CardTitle>
              <CardDescription>
                {remainingMinor === 0
                  ? "This order has been fully refunded."
                  : "Refunds are paid to the customer's account on file."}
              </CardDescription>
            </CardHeader>
            {remainingMinor > 0 && (
              <CardContent>
                <RefundForm
                  orderId={order.id}
                  currency={order.currency}
                  remainingLabel={formatMoney(remainingMinor, order.currency)}
                  thresholdLabel={formatMoney(
                    refundApprovalThresholdMinor(),
                    "USD",
                  )}
                />
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Refunds</h2>
        <div className="bg-card rounded-xl border">
          <DataTable
            rows={refunds}
            rowKey={(refund) => refund.id}
            empty="No refunds on this order."
            columns={[
              {
                header: "Amount",
                cell: (refund) => (
                  <Link
                    href={`/refunds/${refund.id}`}
                    className="text-primary font-medium tabular-nums hover:underline"
                  >
                    {formatMoney(refund.amountMinor, refund.currency)}
                  </Link>
                ),
              },
              {
                header: "Status",
                cell: (refund) => <RefundStateBadge state={refund.state} />,
              },
              {
                header: "Reason",
                className: "max-w-xs whitespace-normal",
                cell: (refund) => refund.reason,
              },
              {
                header: "Requested by",
                cell: (refund) => refund.requestedBy.name,
              },
              {
                header: "When",
                className: "text-muted-foreground whitespace-nowrap",
                cell: (refund) => <LocalTime date={refund.createdAt} />,
              },
            ]}
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
          <CardDescription>
            Account number reveals and other activity on this order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordHistory
            viewer={viewer}
            entityType="Order"
            entityId={order.id}
          />
        </CardContent>
      </Card>
    </PageBody>
  );
}

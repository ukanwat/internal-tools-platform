import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/platform/permissions";
import {
  DataTable,
  FilterBar,
  LinkTabs,
  PageBody,
  PageHeader,
  Pagination,
} from "@/platform/ui";
import { LocalTime } from "@/platform/ui/local-time";
import { RefundStateBadge } from "@/tools/refunds/components/refund-state-badge";
import { formatMoney } from "@/tools/refunds/money";
import {
  listRefunds,
  ORDER_SEARCH_LIMIT,
  searchOrders,
} from "@/tools/refunds/query";
import { settleRefunds } from "@/tools/refunds/service";
import {
  parseRefundState,
  REFUND_STATE_LABELS,
  REFUND_STATES,
} from "@/tools/refunds/status";

export const metadata: Metadata = { title: "Refunds" };

const BASE_PATH = "/refunds";

export default async function RefundsPage({
  searchParams,
}: PageProps<"/refunds">) {
  await requirePermission("refunds.view");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const state = parseRefundState(params.state);
  const requestedPage = Number(params.page);

  await settleRefunds();
  const [orders, { refunds, total, page, pageCount }] = await Promise.all([
    searchOrders(q),
    listRefunds({
      state,
      page: Number.isInteger(requestedPage) ? requestedPage : 1,
    }),
  ]);

  const query = (next: { state?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (next.state) search.set("state", next.state);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    const text = search.toString();
    return text ? `${BASE_PATH}?${text}` : BASE_PATH;
  };

  return (
    <PageBody>
      <PageHeader
        title="Refunds"
        description="Find a customer's order to refund it, or follow up on refunds already made."
      />

      <FilterBar
        key={q}
        basePath={BASE_PATH}
        search={{
          name: "q",
          label: "Find an order",
          placeholder: "Order number, customer name or email",
          value: q,
        }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {q ? `Orders matching “${q}”` : "Recent orders"}
        </h2>
        {orders.length === ORDER_SEARCH_LIMIT && (
          <p className="text-muted-foreground text-sm">
            Showing the {ORDER_SEARCH_LIMIT} most recent matches. Search by
            order number or full email to narrow it down.
          </p>
        )}
        <div className="bg-card rounded-xl border">
          <DataTable
            rows={orders}
            rowKey={(order) => order.id}
            empty={q ? "No orders match that search." : "No orders yet."}
            columns={[
              {
                header: "Order",
                cell: (order) => (
                  <Link
                    href={`/refunds/orders/${order.id}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {order.number}
                  </Link>
                ),
              },
              {
                header: "Customer",
                cell: (order) => (
                  <div className="flex flex-col">
                    <span>{order.customerName}</span>
                    <span className="text-muted-foreground text-xs">
                      {order.customerEmail}
                    </span>
                  </div>
                ),
              },
              {
                header: "Amount",
                className: "tabular-nums",
                cell: (order) => formatMoney(order.amountMinor, order.currency),
              },
              {
                header: "Placed",
                className: "text-muted-foreground whitespace-nowrap",
                cell: (order) => <LocalTime date={order.placedAt} />,
              },
            ]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Refunds{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({total})
          </span>
        </h2>
        <LinkTabs
          tabs={[
            { href: query({}), label: "All", active: !state },
            ...REFUND_STATES.map((s) => ({
              href: query({ state: s }),
              label: REFUND_STATE_LABELS[s],
              active: s === state,
            })),
          ]}
        />
        <div className="bg-card rounded-xl border">
          <DataTable
            rows={refunds}
            rowKey={(refund) => refund.id}
            empty="No refunds here."
            columns={[
              {
                header: "Refund",
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
                header: "Order",
                cell: (refund) => (
                  <div className="flex flex-col">
                    <span>{refund.order.number}</span>
                    <span className="text-muted-foreground text-xs">
                      {refund.order.customerName}
                    </span>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (refund) => <RefundStateBadge state={refund.state} />,
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
        <Pagination
          page={page}
          pageCount={pageCount}
          hrefForPage={(p) => query({ state, page: p })}
        />
      </section>
    </PageBody>
  );
}

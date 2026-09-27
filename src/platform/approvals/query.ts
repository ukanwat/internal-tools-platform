import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { hasPermission } from "@/platform/permissions/policy";

import { approvalRegistry, type ApprovalRegistry } from "./registry";

export const APPROVALS_PAGE_SIZE = 50;

export const APPROVAL_TABS = ["waiting", "all", "mine"] as const;
export type ApprovalTab = (typeof APPROVAL_TABS)[number];

export function parseApprovalTab(value: unknown): ApprovalTab {
  return APPROVAL_TABS.find((tab) => tab === value) ?? "waiting";
}

/** Types whose requests this user's role may decide. */
function decidableTypes(user: CurrentUser, registry: ApprovalRegistry) {
  return registry
    .list()
    .filter((type) => hasPermission(user.role, type.decidePermission))
    .map((type) => type.key);
}

function tabWhere(
  user: CurrentUser,
  tab: ApprovalTab,
  registry: ApprovalRegistry,
): Prisma.ApprovalRequestWhereInput {
  const types = decidableTypes(user, registry);
  switch (tab) {
    case "waiting":
      return {
        status: "PENDING",
        type: { in: types },
        requestedById: { not: user.id },
      };
    case "mine":
      return { requestedById: user.id };
    case "all":
      return { OR: [{ requestedById: user.id }, { type: { in: types } }] };
  }
}

/** Only requests the user made or can decide; nothing else is ever returned. */
export async function listApprovals(
  user: CurrentUser,
  tab: ApprovalTab,
  registry: ApprovalRegistry = approvalRegistry,
  requestedPage = 1,
) {
  const counts = await Promise.all(
    APPROVAL_TABS.map((t) =>
      db.approvalRequest.count({ where: tabWhere(user, t, registry) }),
    ),
  );
  const countByTab = Object.fromEntries(
    APPROVAL_TABS.map((t, i) => [t, counts[i]]),
  ) as Record<ApprovalTab, number>;
  const pageCount = Math.max(
    1,
    Math.ceil(countByTab[tab] / APPROVALS_PAGE_SIZE),
  );
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  const requests = await db.approvalRequest.findMany({
    where: tabWhere(user, tab, registry),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * APPROVALS_PAGE_SIZE,
    take: APPROVALS_PAGE_SIZE,
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      decidedBy: { select: { id: true, name: true, role: true } },
    },
  });

  const types = new Set(decidableTypes(user, registry));
  return {
    requests: requests.map((request) => ({
      ...request,
      typeLabel: registry.get(request.type)?.label ?? request.type,
      canDecide:
        request.status === "PENDING" &&
        types.has(request.type) &&
        request.requestedById !== user.id,
    })),
    counts: countByTab,
    page,
    pageCount,
  };
}

export type ApprovalListItem = Awaited<
  ReturnType<typeof listApprovals>
>["requests"][number];

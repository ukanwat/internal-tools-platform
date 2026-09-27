import "server-only";

import type { AuditOutcome } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/platform/db";

import { SIGN_IN_ACTIONS } from "./labels";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = {
  actorId?: string;
  action?: string;
  outcome?: AuditOutcome;
  page?: number;
  /** Show sign-in and sign-out entries (hidden by default on the audit page). */
  includeSignIns?: boolean;
  /** Leave out sign-in and sign-out entries. */
  hideSignIns?: boolean;
};

export async function listAuditEntries(filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: filters.actorId,
    action: filters.hideSignIns
      ? {
          ...(filters.action && { equals: filters.action }),
          notIn: SIGN_IN_ACTIONS,
        }
      : filters.action,
    outcome: filters.outcome,
  };
  const total = await db.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);

  const entries = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });

  return {
    entries,
    total,
    page,
    pageCount,
  };
}

export type AuditLogEntry = Awaited<
  ReturnType<typeof listAuditEntries>
>["entries"][number];

/** Options for the filter dropdowns. */
export async function getAuditFilterOptions() {
  const [actors, actions] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);
  return { actors, actions: actions.map((a) => a.action) };
}

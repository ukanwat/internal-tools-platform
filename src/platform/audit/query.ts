import "server-only";

import type { AuditOutcome } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/platform/db";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = {
  actorId?: string;
  action?: string;
  outcome?: AuditOutcome;
  page?: number;
};

export async function listAuditEntries(filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: filters.actorId,
    action: filters.action,
    outcome: filters.outcome,
  };
  const page = Math.max(1, filters.page ?? 1);

  const [entries, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    entries,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
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

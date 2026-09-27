import { AuditOutcome } from "@/generated/prisma/enums";

import type { AuditFilters } from "./query";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v ? v : undefined;
}

/** Parses `?actor=&action=&outcome=&page=`, dropping invalid values. */
export function parseAuditFilters(params: SearchParams): AuditFilters {
  const outcome = first(params.outcome);
  const page = Number.parseInt(first(params.page) ?? "", 10);
  return {
    actorId: first(params.actor),
    action: first(params.action),
    outcome:
      outcome && outcome in AuditOutcome
        ? (outcome as AuditOutcome)
        : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function auditFiltersToQuery(filters: AuditFilters): string {
  const query = new URLSearchParams();
  if (filters.actorId) query.set("actor", filters.actorId);
  if (filters.action) query.set("action", filters.action);
  if (filters.outcome) query.set("outcome", filters.outcome);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  const s = query.toString();
  return s ? `?${s}` : "";
}

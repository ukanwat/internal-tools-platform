import "server-only";

import type { AuditOutcome } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/platform/auth/types";
import { db, type DbClient } from "@/platform/db";
import { redactSensitive } from "@/platform/sensitive/fields";

export type AuditEntry = {
  /** Who did it. `null` for anonymous requests (e.g. denied before sign-in). */
  actor: CurrentUser | null;
  /** What they did, e.g. `refunds.approve`. */
  action: string;
  /** Defaults to `SUCCESS`. */
  outcome?: AuditOutcome;
  /** Which record. */
  entity?: { type: string; id: string };
  /** Record state before and after the change. */
  before?: unknown;
  after?: unknown;
  /** Why. */
  reason?: string;
};

/**
 * The only way to write to the audit log.
 *
 * When the audited change is a database write, pass the transaction client
 * so the change and its entry commit or roll back together:
 *
 *   await db.$transaction(async (tx) => {
 *     const after = await tx.refund.update({ ... });
 *     await recordAudit({ actor, action: "refunds.approve", entity, before, after, reason }, tx);
 *   });
 */
export async function recordAudit(
  entry: AuditEntry,
  client: DbClient = db,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      outcome: entry.outcome ?? "SUCCESS",
      entityType: entry.entity?.type ?? null,
      entityId: entry.entity?.id ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      reason: entry.reason ?? null,
    },
  });
}

/**
 * Snapshots a value as plain JSON (Dates to ISO strings, Decimals to strings)
 * with sensitive fields masked.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return redactSensitive(
    JSON.parse(JSON.stringify(value)),
  ) as Prisma.InputJsonValue;
}

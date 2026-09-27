import "server-only";

import { db } from "@/platform/db";

type EntityRef = { entityType: string | null; entityId: string | null };

export function recordKey(type: string, id: string) {
  return `${type}:${id}`;
}

/** Human-readable names for the records audit entries point at, keyed by `recordKey`. */
export async function resolveRecordNames(
  entries: EntityRef[],
): Promise<Record<string, string>> {
  const idsFor = (type: string) => [
    ...new Set(
      entries
        .filter((e) => e.entityType === type && e.entityId)
        .map((e) => e.entityId!),
    ),
  ];
  const [requests, users] = await Promise.all([
    db.approvalRequest.findMany({
      where: { id: { in: idsFor("ApprovalRequest") } },
      select: { id: true, summary: true },
    }),
    db.user.findMany({
      where: { id: { in: idsFor("User") } },
      select: { id: true, name: true },
    }),
  ]);
  return Object.fromEntries([
    ...requests.map((r) => [recordKey("ApprovalRequest", r.id), r.summary]),
    ...users.map((u) => [recordKey("User", u.id), u.name]),
  ]);
}

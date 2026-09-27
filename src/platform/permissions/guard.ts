import "server-only";

import { forbidden, redirect } from "next/navigation";

import { recordAudit } from "@/platform/audit/record";
import { getCurrentUser } from "@/platform/auth/session";
import type { CurrentUser } from "@/platform/auth/types";

import { hasPermission, type Permission } from "./policy";

export type AuthorizationResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Checks `user` against the role policy. Denials are written to the audit log
 * (outside any caller transaction, so they persist) before returning.
 */
export async function authorize(
  user: CurrentUser | null,
  permission: Permission,
  entity?: { type: string; id: string },
): Promise<AuthorizationResult> {
  if (user && hasPermission(user.role, permission)) {
    return { ok: true, user };
  }

  const reason = user ? "forbidden" : "unauthenticated";
  await recordAudit({
    actor: user,
    action: permission,
    outcome: "DENIED",
    entity,
    reason: user
      ? `Role ${user.role} lacks permission ${permission}`
      : `Not signed in; ${permission} requires a session`,
  });
  return { ok: false, reason };
}

/**
 * Call at the top of every server action and protected page. Returns the
 * signed-in user, or logs the denial and then redirects to /login
 * (no session) or renders 403 (missing permission).
 */
export async function requirePermission(
  permission: Permission,
  entity?: { type: string; id: string },
): Promise<CurrentUser> {
  const result = await authorize(await getCurrentUser(), permission, entity);
  if (result.ok) return result.user;
  if (result.reason === "unauthenticated") redirect("/login");
  forbidden();
}

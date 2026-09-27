import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "./session";
import type { CurrentUser } from "./types";

export { getCurrentUser } from "./session";
export type { CurrentUser } from "./types";

/** For pages that only need a signed-in user. Use requirePermission for anything gated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

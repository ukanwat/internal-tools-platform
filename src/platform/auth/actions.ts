"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/platform/audit/record";
import { db } from "@/platform/db";

import { endSession, getCurrentUser, startSession } from "./session";

// These two actions establish or end the session, so they are the only server
// actions that do not call requirePermission.

export async function signInAs(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (typeof userId !== "string") throw new Error("Missing userId");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) throw new Error("Unknown user");

  await startSession(user.id);
  await recordAudit({
    actor: user,
    action: "auth.sign_in",
    entity: { type: "User", id: user.id },
  });
  redirect("/");
}

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await recordAudit({
      actor: user,
      action: "auth.sign_out",
      entity: { type: "User", id: user.id },
    });
  }
  await endSession();
  redirect("/login");
}

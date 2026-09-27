import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/platform/db";

import { createSessionToken, verifySessionToken } from "./session-token";
import type { CurrentUser } from "./types";

export const SESSION_COOKIE = "itp_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

export async function startSession(userId: string): Promise<void> {
  const iat = Math.floor(Date.now() / 1000);
  const token = createSessionToken(
    { sub: userId, iat, exp: iat + SESSION_TTL_SECONDS },
    sessionSecret(),
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, re-read from the database on every request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token, sessionSecret());
  if (!payload) return null;

  return db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  });
});

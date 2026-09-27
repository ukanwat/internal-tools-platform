import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "../../../test/db";

import { SEED_USERS } from "@/platform/auth/seed-users";
import { createSessionToken } from "@/platform/auth/session-token";
import { db } from "@/platform/db";

import { PERMISSIONS, ROLE_PERMISSIONS } from "./policy";

const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "itp_session" && mocks.cookie !== undefined
        ? { name, value: mocks.cookie }
        : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { requirePermission } = await import("./guard");

setupTestDatabase();

beforeEach(() => {
  mocks.cookie = undefined;
});

function signedCookieFor(userId: string, secret = process.env.SESSION_SECRET!) {
  const iat = Math.floor(Date.now() / 1000);
  return createSessionToken({ sub: userId, iat, exp: iat + 3600 }, secret);
}

const deniedCases = SEED_USERS.flatMap((user) =>
  PERMISSIONS.filter((p) => !ROLE_PERMISSIONS[user.role].includes(p)).map(
    (permission) => ({ user, permission }),
  ),
);

const allowedCases = SEED_USERS.flatMap((user) =>
  ROLE_PERMISSIONS[user.role].map((permission) => ({ user, permission })),
);

describe("blocked users are logged", () => {
  it.each(deniedCases)(
    "$user.role is blocked from $permission and the denial is logged",
    async ({ user, permission }) => {
      mocks.cookie = signedCookieFor(user.id);

      await expect(
        requirePermission(permission, { type: "Record", id: "rec_1" }),
      ).rejects.toThrow("FORBIDDEN");

      const entries = await db.auditLog.findMany();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: user.id,
        actorRole: user.role,
        action: permission,
        outcome: "DENIED",
        entityType: "Record",
        entityId: "rec_1",
        reason: `Role ${user.role} lacks permission ${permission}`,
      });
    },
  );

  it.each(allowedCases)(
    "$user.role is allowed $permission without a denial entry",
    async ({ user, permission }) => {
      mocks.cookie = signedCookieFor(user.id);
      await expect(requirePermission(permission)).resolves.toMatchObject({
        id: user.id,
      });
      expect(await db.auditLog.count()).toBe(0);
    },
  );

  it("treats a cookie edited to another user as signed out, and logs it", async () => {
    const [body, signature] = signedCookieFor("user_support").split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const forgedBody = Buffer.from(
      JSON.stringify({ ...payload, sub: "user_admin" }),
    ).toString("base64url");
    mocks.cookie = `${forgedBody}.${signature}`;

    await expect(requirePermission("audit.view")).rejects.toThrow(
      "REDIRECT /login",
    );
    expect(await db.auditLog.findMany()).toMatchObject([
      { actorId: null, action: "audit.view", outcome: "DENIED" },
    ]);
  });

  it("rejects a cookie signed with a different secret, and logs it", async () => {
    mocks.cookie = signedCookieFor("user_admin", "x".repeat(32));

    await expect(requirePermission("audit.view")).rejects.toThrow(
      "REDIRECT /login",
    );
    expect(await db.auditLog.count({ where: { outcome: "DENIED" } })).toBe(1);
  });

  it("blocks and logs a request with no session", async () => {
    await expect(requirePermission("refunds.approve")).rejects.toThrow(
      "REDIRECT /login",
    );
    expect(await db.auditLog.findMany()).toMatchObject([
      { actorId: null, action: "refunds.approve", outcome: "DENIED" },
    ]);
  });
});

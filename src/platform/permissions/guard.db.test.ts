import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";

const mocks = vi.hoisted(() => ({
  currentUser: null as CurrentUser | null,
  calls: [] as string[],
}));

vi.mock("@/platform/auth/session", () => ({
  getCurrentUser: async () => mocks.currentUser,
}));

vi.mock("@/platform/audit/record", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/audit/record")>();
  return {
    recordAudit: async (...args: Parameters<typeof actual.recordAudit>) => {
      await actual.recordAudit(...args);
      mocks.calls.push("audit committed");
    },
  };
});

vi.mock("next/navigation", () => ({
  forbidden: () => {
    mocks.calls.push("forbidden");
    throw new Error("FORBIDDEN");
  },
  redirect: (url: string) => {
    mocks.calls.push(`redirect ${url}`);
    throw new Error("REDIRECT");
  },
}));

const { authorize, requirePermission } = await import("./guard");

setupTestDatabase();

beforeEach(() => {
  mocks.currentUser = null;
  mocks.calls = [];
});

describe("authorize", () => {
  it("allows a permitted role without writing an audit entry", async () => {
    const user = seedUser("ADMIN");
    await expect(authorize(user, "audit.view")).resolves.toEqual({
      ok: true,
      user,
    });
    expect(await db.auditLog.count()).toBe(0);
  });

  it("logs a denial for a signed-in user lacking the permission", async () => {
    const user = seedUser("SUPPORT");
    const result = await authorize(user, "refunds.approve", {
      type: "Refund",
      id: "rf_1",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    const [entry] = await db.auditLog.findMany();
    expect(entry).toMatchObject({
      actorId: user.id,
      actorRole: "SUPPORT",
      action: "refunds.approve",
      outcome: "DENIED",
      entityType: "Refund",
      entityId: "rf_1",
      reason: "Role SUPPORT lacks permission refunds.approve",
    });
  });

  it("logs a denial for an anonymous request", async () => {
    const result = await authorize(null, "audit.view");
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    const [entry] = await db.auditLog.findMany();
    expect(entry).toMatchObject({
      actorId: null,
      action: "audit.view",
      outcome: "DENIED",
    });
  });
});

describe("requirePermission", () => {
  it("returns the current user when permitted", async () => {
    mocks.currentUser = seedUser("COMPLIANCE_LEAD");
    await expect(requirePermission("audit.view")).resolves.toEqual(
      mocks.currentUser,
    );
  });

  it("writes the denial before calling forbidden()", async () => {
    mocks.currentUser = seedUser("FINANCE_APPROVER");
    await expect(requirePermission("audit.view")).rejects.toThrow("FORBIDDEN");
    expect(mocks.calls).toEqual(["audit committed", "forbidden"]);
    expect(await db.auditLog.count({ where: { outcome: "DENIED" } })).toBe(1);
  });

  it("writes the denial before redirecting anonymous users to /login", async () => {
    await expect(requirePermission("audit.view")).rejects.toThrow("REDIRECT");
    expect(mocks.calls).toEqual(["audit committed", "redirect /login"]);
    expect(await db.auditLog.count({ where: { outcome: "DENIED" } })).toBe(1);
  });
});

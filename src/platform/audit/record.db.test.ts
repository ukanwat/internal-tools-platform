import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { db } from "@/platform/db";

import { recordAudit } from "./record";

setupTestDatabase();

describe("recordAudit", () => {
  it("stores who, what, which record, before, after and why", async () => {
    const actor = seedUser("FINANCE_APPROVER");
    await recordAudit({
      actor,
      action: "refunds.approve",
      entity: { type: "Refund", id: "rf_1" },
      before: { status: "PENDING", at: new Date("2026-01-01T00:00:00Z") },
      after: { status: "APPROVED" },
      reason: "Duplicate charge confirmed",
    });

    const entry = await db.auditLog.findFirstOrThrow();
    expect(entry).toMatchObject({
      actorId: actor.id,
      actorRole: "FINANCE_APPROVER",
      action: "refunds.approve",
      outcome: "SUCCESS",
      entityType: "Refund",
      entityId: "rf_1",
      before: { status: "PENDING", at: "2026-01-01T00:00:00.000Z" },
      after: { status: "APPROVED" },
      reason: "Duplicate charge confirmed",
    });
  });

  it("always masks sensitive fields in before and after", async () => {
    await recordAudit({
      actor: seedUser("FINANCE_APPROVER"),
      action: "customers.update",
      entity: { type: "Customer", id: "cus_1" },
      before: { accountNumber: "GB29NWBK60161331926819", name: "Jo" },
      after: { accountNumber: "GB94BARC10201530093459", name: "Jo" },
    });
    const entry = await db.auditLog.findFirstOrThrow();
    expect(entry.before).toEqual({ accountNumber: "••••6819", name: "Jo" });
    expect(entry.after).toEqual({ accountNumber: "••••3459", name: "Jo" });
  });

  it("commits with the change when written in the same transaction", async () => {
    const actor = seedUser("ADMIN");
    await db.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: "user_support" },
      });
      const after = await tx.user.update({
        where: { id: before.id },
        data: { name: "Sam Renamed" },
      });
      await recordAudit(
        {
          actor,
          action: "users.rename",
          entity: { type: "User", id: before.id },
          before,
          after,
          reason: "Name change request",
        },
        tx,
      );
    });

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: "user_support" } })).name,
    ).toBe("Sam Renamed");
    expect(await db.auditLog.count()).toBe(1);
  });

  it("rolls back with the change when the transaction fails", async () => {
    const actor = seedUser("ADMIN");
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: "user_support" },
          data: { name: "Sam Renamed" },
        });
        await recordAudit(
          { actor, action: "users.rename", reason: "Test" },
          tx,
        );
        throw new Error("downstream failure");
      }),
    ).rejects.toThrow("downstream failure");

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: "user_support" } })).name,
    ).toBe("Sam Support");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("is append-only", async () => {
    await recordAudit({ actor: null, action: "test.event" });
    await expect(
      db.auditLog.updateMany({ data: { reason: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditLog.deleteMany()).rejects.toThrow(/append-only/);
  });
});

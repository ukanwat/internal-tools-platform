import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { db } from "@/platform/db";

import { revealSensitiveValue, toSensitiveView } from "./service";
import { createSensitiveSourceRegistry } from "./sources";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const reviewer = seedUser("COMPLIANCE_REVIEWER");

const ACCOUNT = "GB29NWBK60161331926819";
const sources = createSensitiveSourceRegistry([
  {
    entityType: "Customer",
    load: async (id, field) =>
      id === "cus_1" && field === "accountNumber" ? ACCOUNT : null,
  },
]);
const entity = { type: "Customer", id: "cus_1" };

describe("toSensitiveView", () => {
  it("masks the value for everyone and only lets permitted roles reveal", () => {
    expect(toSensitiveView(finance, "accountNumber", entity, ACCOUNT)).toEqual({
      field: "accountNumber",
      label: "Account number",
      entity,
      masked: "••••6819",
      canReveal: true,
    });
    expect(
      toSensitiveView(support, "accountNumber", entity, ACCOUNT),
    ).toMatchObject({
      masked: "••••6819",
      canReveal: false,
    });
    expect(
      toSensitiveView(reviewer, "accountNumber", entity, ACCOUNT).canReveal,
    ).toBe(false);
    expect(
      toSensitiveView(reviewer, "idNumber", entity, "AB123456789C").canReveal,
    ).toBe(true);
  });

  it("never includes the raw value", () => {
    const view = toSensitiveView(finance, "accountNumber", entity, ACCOUNT);
    expect(JSON.stringify(view)).not.toContain(ACCOUNT);
  });
});

describe("revealSensitiveValue", () => {
  it("returns the value and logs who looked, at what, and why", async () => {
    const result = await revealSensitiveValue(
      finance,
      { field: "accountNumber", entity, reason: "Confirm refund destination" },
      sources,
    );
    expect(result).toEqual({ ok: true, value: ACCOUNT });
    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: "sensitive.reveal" },
    });
    expect(entry).toMatchObject({
      actorId: finance.id,
      outcome: "SUCCESS",
      entityType: "Customer",
      entityId: "cus_1",
      after: { field: "accountNumber" },
      reason: "Confirm refund destination",
    });
    expect(JSON.stringify(entry)).not.toContain(ACCOUNT);
  });

  it("blocks and logs a role without the reveal permission", async () => {
    const result = await revealSensitiveValue(
      support,
      { field: "accountNumber", entity, reason: "curious" },
      sources,
    );
    expect(result.ok).toBe(false);
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: support.id } }),
    ).toMatchObject({
      action: "pii.reveal_account_number",
      outcome: "DENIED",
      entityId: "cus_1",
    });
    expect(
      await db.auditLog.count({ where: { action: "sensitive.reveal" } }),
    ).toBe(0);
  });

  it("requires a reason and does not log a reveal without one", async () => {
    expect(
      await revealSensitiveValue(
        finance,
        { field: "accountNumber", entity, reason: " " },
        sources,
      ),
    ).toEqual({ ok: false, error: "A reason is required" });
    expect(
      await db.auditLog.count({ where: { action: "sensitive.reveal" } }),
    ).toBe(0);
  });

  it("fails cleanly for unknown record types or missing values", async () => {
    const unknown = await revealSensitiveValue(
      finance,
      {
        field: "accountNumber",
        entity: { type: "Other", id: "x" },
        reason: "r",
      },
      sources,
    );
    expect(unknown.ok).toBe(false);
    const missing = await revealSensitiveValue(
      finance,
      {
        field: "accountNumber",
        entity: { type: "Customer", id: "cus_2" },
        reason: "r",
      },
      sources,
    );
    expect(missing).toEqual({ ok: false, error: "Value not found" });
    expect(
      await db.auditLog.count({ where: { action: "sensitive.reveal" } }),
    ).toBe(0);
  });
});

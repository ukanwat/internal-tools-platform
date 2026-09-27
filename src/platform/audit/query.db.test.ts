import { beforeEach, describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { getAuditFilterOptions, listAuditEntries } from "./query";
import { recordAudit } from "./record";

setupTestDatabase();

beforeEach(async () => {
  const support = seedUser("SUPPORT");
  const admin = seedUser("ADMIN");
  await recordAudit({ actor: support, action: "auth.sign_in" });
  await recordAudit({
    actor: support,
    action: "audit.view",
    outcome: "DENIED",
  });
  await recordAudit({ actor: admin, action: "auth.sign_in" });
  await recordAudit({ actor: admin, action: "audit.view", outcome: "DENIED" });
});

describe("listAuditEntries", () => {
  it("leaves out sign-ins with hideSignIns", async () => {
    const { entries, total } = await listAuditEntries({ hideSignIns: true });
    expect(total).toBe(2);
    expect(entries.every((e) => e.action !== "auth.sign_in")).toBe(true);
  });

  it("combines hideSignIns with an action filter", async () => {
    const { total } = await listAuditEntries({
      hideSignIns: true,
      action: "audit.view",
    });
    expect(total).toBe(2);
  });

  it("returns everything, newest first, without filters", async () => {
    const { entries, total } = await listAuditEntries({});
    expect(total).toBe(4);
    expect(entries[0].actor?.name).toBe("Ada Admin");
    expect(entries[0].action).toBe("audit.view");
  });

  it("filters by person, action and outcome together", async () => {
    const { entries } = await listAuditEntries({
      actorId: "user_support",
      action: "audit.view",
      outcome: "DENIED",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: "user_support",
      action: "audit.view",
      outcome: "DENIED",
    });
  });

  it("clamps an out-of-range page to the last page", async () => {
    const { entries, page, pageCount } = await listAuditEntries({
      page: 10_000_000_000,
    });
    expect(page).toBe(1);
    expect(pageCount).toBe(1);
    expect(entries).toHaveLength(4);
  });

  it("filters by outcome alone", async () => {
    const { total } = await listAuditEntries({ outcome: "SUCCESS" });
    expect(total).toBe(2);
  });
});

describe("getAuditFilterOptions", () => {
  it("lists people and distinct actions", async () => {
    const { actors, actions } = await getAuditFilterOptions();
    expect(actors).toHaveLength(5);
    expect(actions).toEqual(["audit.view", "auth.sign_in"]);
  });
});

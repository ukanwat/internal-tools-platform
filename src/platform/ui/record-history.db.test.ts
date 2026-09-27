import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { recordAudit } from "@/platform/audit/record";

import { listRecordHistory } from "./record-history";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const admin = seedUser("ADMIN");
const entity = { type: "ApprovalRequest", id: "req_1" };

async function seedHistory() {
  await recordAudit({
    actor: support,
    action: "approvals.request",
    entity,
    reason: "Charged twice",
  });
  await recordAudit({
    actor: support,
    action: "approvals.approve",
    outcome: "DENIED",
    entity,
    reason: "Cannot decide your own request",
  });
  await recordAudit({
    actor: finance,
    action: "approvals.fail",
    outcome: "FAILURE",
    entity,
    reason: "Provider error for card 4242",
    before: { lastError: "Provider error for card 4242" },
  });
}

const history = (viewer: typeof support) =>
  listRecordHistory({ viewer, entityType: entity.type, entityId: entity.id });

describe("listRecordHistory", () => {
  it("hides denied entries, failure reasons and snapshots without audit.view", async () => {
    await seedHistory();
    expect(
      (await history(support)).every(
        (e) => e.before === null && e.after === null,
      ),
    ).toBe(true);
    expect(
      (await history(support)).map((e) => [e.action, e.outcome, e.reason]),
    ).toEqual([
      ["approvals.request", "SUCCESS", "Charged twice"],
      ["approvals.fail", "FAILURE", null],
    ]);
  });

  it("shows everything to audit viewers", async () => {
    await seedHistory();
    expect(
      (await history(admin)).map((e) => [e.action, e.outcome, e.reason]),
    ).toEqual([
      ["approvals.request", "SUCCESS", "Charged twice"],
      ["approvals.approve", "DENIED", "Cannot decide your own request"],
      ["approvals.fail", "FAILURE", "Provider error for card 4242"],
    ]);
  });
});

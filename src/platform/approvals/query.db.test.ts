import { beforeEach, describe, expect, it } from "vitest";

import { testRegistry } from "../../../test/approvals";
import { seedUser, setupTestDatabase } from "../../../test/db";

import { db } from "@/platform/db";

import { APPROVALS_PAGE_SIZE, listApprovals, parseApprovalTab } from "./query";

setupTestDatabase();

const support = seedUser("SUPPORT");
const finance = seedUser("FINANCE_APPROVER");
const reviewer = seedUser("COMPLIANCE_REVIEWER");

const base = { payload: {}, summary: "s", requestReason: "r" };

beforeEach(async () => {
  await db.approvalRequest.createMany({
    data: [
      {
        ...base,
        id: "a_pending",
        type: "test.refund",
        requestedById: support.id,
      },
      {
        ...base,
        id: "a_done",
        type: "test.refund",
        requestedById: support.id,
        status: "COMPLETED",
      },
      {
        ...base,
        id: "a_by_finance",
        type: "test.refund",
        requestedById: finance.id,
      },
      {
        ...base,
        id: "a_unregistered",
        type: "other.kind",
        requestedById: reviewer.id,
      },
    ],
  });
});

const ids = async (...args: Parameters<typeof listApprovals>) =>
  (await listApprovals(...args)).requests.map((r) => r.id).sort();

describe("listApprovals", () => {
  it("shows a decider pending requests from others under waiting", async () => {
    expect(await ids(finance, "waiting", testRegistry)).toEqual(["a_pending"]);
  });

  it("shows a decider everything they made or can decide under all", async () => {
    expect(await ids(finance, "all", testRegistry)).toEqual([
      "a_by_finance",
      "a_done",
      "a_pending",
    ]);
  });

  it("shows a requester only their own requests", async () => {
    expect(await ids(support, "all", testRegistry)).toEqual([
      "a_done",
      "a_pending",
    ]);
    expect(await ids(support, "waiting", testRegistry)).toEqual([]);
    expect(await ids(support, "mine", testRegistry)).toEqual([
      "a_done",
      "a_pending",
    ]);
  });

  it("never shows unrelated requests and hides unregistered types from deciders", async () => {
    expect(await ids(reviewer, "all", testRegistry)).toEqual([
      "a_unregistered",
    ]);
    expect(await ids(finance, "all", testRegistry)).not.toContain(
      "a_unregistered",
    );
  });

  it("marks only pending, decidable requests from others as decidable", async () => {
    const { requests, counts } = await listApprovals(
      finance,
      "all",
      testRegistry,
    );
    const decidable = requests.filter((r) => r.canDecide).map((r) => r.id);
    expect(decidable).toEqual(["a_pending"]);
    expect(counts).toEqual({ waiting: 1, all: 3, mine: 1 });
  });

  it("pages results and clamps out-of-range pages to the last page", async () => {
    await db.approvalRequest.createMany({
      data: Array.from({ length: APPROVALS_PAGE_SIZE }, (_, i) => ({
        ...base,
        id: `a_bulk_${i}`,
        type: "test.refund",
        requestedById: support.id,
        createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)),
      })),
    });
    const last = await listApprovals(support, "all", testRegistry, 999);
    expect(last.page).toBe(2);
    expect(last.pageCount).toBe(2);
    expect(last.requests).toHaveLength(2);
    expect(last.requests.map((r) => r.id)).toEqual(["a_bulk_1", "a_bulk_0"]);
  });

  it("parses unknown tabs as waiting", () => {
    expect(parseApprovalTab("mine")).toBe("mine");
    expect(parseApprovalTab("toString")).toBe("waiting");
    expect(parseApprovalTab(undefined)).toBe("waiting");
  });
});

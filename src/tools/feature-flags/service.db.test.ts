import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import type { FlagEnvironment } from "@/generated/prisma/enums";
import { SEED_USERS } from "@/platform/auth/seed-users";
import { approveApprovalRequest } from "@/platform/approvals/service";
import { db } from "@/platform/db";

import { flagProductionChangeType } from "./approval-type";
import { changeFlag, STALE_MESSAGE, turnOffFlag } from "./service";

setupTestDatabase();

const engineer = seedUser("ENGINEER");
const manager = seedUser("ENG_MANAGER");
const otherManager = SEED_USERS.find((u) => u.id === "user_eng_manager_2")!;
const support = seedUser("SUPPORT");

async function seedState(
  environment: FlagEnvironment,
  setting: { enabled: boolean; rolloutPercent: number },
) {
  const flag = await db.featureFlag.upsert({
    where: { key: "checkout-v2" },
    update: {},
    create: { key: "checkout-v2", description: "Test flag" },
  });
  return db.featureFlagState.create({
    data: { flagId: flag.id, environment, ...setting },
  });
}

const stateOf = (id: string) =>
  db.featureFlagState.findUniqueOrThrow({ where: { id } });

const flagAudit = (id: string) =>
  db.auditLog.findMany({
    where: { entityType: "FeatureFlagState", entityId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

async function requestProductionChange(
  requester = engineer,
  to = { enabled: true, rolloutPercent: 25 },
) {
  const state = await seedState("PRODUCTION", {
    enabled: false,
    rolloutPercent: 0,
  });
  const result = await changeFlag(requester, {
    stateId: state.id,
    expectedVersion: 0,
    to,
    reason: "Launch to a quarter of users",
  });
  expect(result).toEqual({
    ok: true,
    message: "Sent to an eng manager for approval",
  });
  const request = await db.approvalRequest.findFirstOrThrow({
    where: { entityId: state.id },
  });
  return { state, request };
}

describe("staging", () => {
  it("applies an engineer's change straight away, audited with before, after and reason", async () => {
    const state = await seedState("STAGING", {
      enabled: false,
      rolloutPercent: 0,
    });
    const result = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 100 },
      reason: "Testing the new flow",
    });
    expect(result).toEqual({ ok: true, message: "Flag updated" });
    expect(await stateOf(state.id)).toMatchObject({
      enabled: true,
      rolloutPercent: 100,
      version: 1,
      updatedById: engineer.id,
    });
    expect(await db.approvalRequest.count()).toBe(0);
    expect(await flagAudit(state.id)).toMatchObject([
      {
        action: "flags.change",
        outcome: "SUCCESS",
        actorId: engineer.id,
        before: { enabled: false, rolloutPercent: 0, environment: "STAGING" },
        after: { enabled: true, rolloutPercent: 100 },
        reason: "Testing the new flow",
      },
    ]);
  });

  it("requires a reason", async () => {
    const state = await seedState("STAGING", {
      enabled: false,
      rolloutPercent: 0,
    });
    const result = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 100 },
      reason: "  ",
    });
    expect(result).toEqual({ ok: false, error: "A reason is required" });
    expect((await stateOf(state.id)).enabled).toBe(false);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("refuses a change made against an out-of-date view", async () => {
    const state = await seedState("STAGING", {
      enabled: true,
      rolloutPercent: 10,
    });
    await db.featureFlagState.update({
      where: { id: state.id },
      data: { rolloutPercent: 30, version: 1 },
    });
    const result = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 20 },
      reason: "x",
    });
    expect(result).toEqual({ ok: false, error: STALE_MESSAGE });
    expect((await stateOf(state.id)).rolloutPercent).toBe(30);
  });
});

describe("production changes that raise exposure", () => {
  it.each([
    [
      "turning on",
      { enabled: false, rolloutPercent: 10 },
      { enabled: true, rolloutPercent: 10 },
    ],
    [
      "raising the rollout",
      { enabled: true, rolloutPercent: 10 },
      { enabled: true, rolloutPercent: 50 },
    ],
  ])(
    "%s creates a pending request and leaves the flag alone",
    async (_, from, to) => {
      const state = await seedState("PRODUCTION", from);
      const result = await changeFlag(engineer, {
        stateId: state.id,
        expectedVersion: 0,
        to,
        reason: "Ready to roll out",
      });
      expect(result.ok).toBe(true);
      expect(await stateOf(state.id)).toMatchObject({ ...from, version: 0 });
      expect(
        await db.approvalRequest.findFirstOrThrow({
          where: { entityId: state.id },
        }),
      ).toMatchObject({
        type: "flags.production_change",
        status: "PENDING",
        requestedById: engineer.id,
        payload: { from, to, baseVersion: 0 },
      });
    },
  );

  it("is applied when an eng manager approves", async () => {
    const { state, request } = await requestProductionChange();
    const result = await approveApprovalRequest(manager, request.id, "LGTM");
    expect(result).toMatchObject({
      ok: true,
      request: { status: "COMPLETED" },
    });
    expect(await stateOf(state.id)).toMatchObject({
      enabled: true,
      rolloutPercent: 25,
      version: 1,
      updatedById: manager.id,
    });
    expect(await flagAudit(state.id)).toMatchObject([
      {
        action: "flags.change",
        actorId: manager.id,
        before: { enabled: false, rolloutPercent: 0 },
        after: {
          enabled: true,
          rolloutPercent: 25,
          approvalRequestId: request.id,
        },
        reason: "Launch to a quarter of users",
      },
    ]);
  });

  it("can't be approved by an engineer, and the attempt is logged", async () => {
    const { state, request } = await requestProductionChange(manager);
    const result = await approveApprovalRequest(engineer, request.id, "ok");
    expect(result.ok).toBe(false);
    expect((await stateOf(state.id)).enabled).toBe(false);
    expect(
      await db.auditLog.findFirst({
        where: { action: "flags.approve_production", outcome: "DENIED" },
      }),
    ).toMatchObject({ actorId: engineer.id, actorRole: "ENGINEER" });
  });

  it("can't be approved by the eng manager who asked, but another one can", async () => {
    const { state, request } = await requestProductionChange(manager);
    expect(await approveApprovalRequest(manager, request.id, "mine")).toEqual({
      ok: false,
      error: "You cannot decide your own request",
    });
    expect((await stateOf(state.id)).enabled).toBe(false);
    expect(
      await db.auditLog.findFirst({
        where: { entityId: request.id, outcome: "DENIED" },
      }),
    ).toMatchObject({ reason: "Cannot decide your own request" });

    const result = await approveApprovalRequest(otherManager, request.id, "ok");
    expect(result.ok).toBe(true);
    expect((await stateOf(state.id)).enabled).toBe(true);
  });

  it("blocks a second request while one is waiting", async () => {
    const { state } = await requestProductionChange();
    const result = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 50 },
      reason: "x",
    });
    expect(result).toEqual({
      ok: false,
      error: "A change to this flag is already waiting for approval",
    });
    expect(await db.approvalRequest.count()).toBe(1);
  });

  it("applies once even if the approved change runs twice", async () => {
    const { state, request } = await requestProductionChange();
    await approveApprovalRequest(manager, request.id, "ok");
    const ctx = {
      request: {
        id: request.id,
        requestedById: engineer.id,
        decidedById: manager.id,
      },
      payload: request.payload,
      idempotencyKey: request.id,
      integrations: {} as never,
    };
    await flagProductionChangeType.execute(ctx);
    expect((await stateOf(state.id)).version).toBe(1);
    expect(await flagProductionChangeType.checkOutcome(ctx)).toBe("completed");
    expect(await db.featureFlagApproval.count()).toBe(1);
  });
});

describe("turning off in production (kill switch)", () => {
  it("works straight away for an engineer with no approval", async () => {
    const state = await seedState("PRODUCTION", {
      enabled: true,
      rolloutPercent: 50,
    });
    const result = await turnOffFlag(engineer, {
      stateId: state.id,
      reason: "INC-42 errors spiking",
    });
    expect(result).toEqual({ ok: true, message: "Flag turned off" });
    expect(await stateOf(state.id)).toMatchObject({
      enabled: false,
      rolloutPercent: 50,
      version: 1,
    });
    expect(await db.approvalRequest.count()).toBe(0);
    expect(await flagAudit(state.id)).toMatchObject([
      {
        action: "flags.turn_off",
        actorId: engineer.id,
        before: { enabled: true },
        after: { enabled: false },
        reason: "INC-42 errors spiking",
      },
    ]);
  });

  it("also applies through a regular change without approval", async () => {
    const state = await seedState("PRODUCTION", {
      enabled: true,
      rolloutPercent: 50,
    });
    const result = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 5 },
      reason: "Scaling back",
    });
    expect(result).toEqual({ ok: true, message: "Flag updated" });
    expect((await stateOf(state.id)).rolloutPercent).toBe(5);
    expect(await db.approvalRequest.count()).toBe(0);
  });

  it("wins over a pending request, which can then no longer turn the flag back on", async () => {
    const state = await seedState("PRODUCTION", {
      enabled: true,
      rolloutPercent: 10,
    });
    await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 0,
      to: { enabled: true, rolloutPercent: 50 },
      reason: "Expand",
    });
    const request = await db.approvalRequest.findFirstOrThrow();

    expect(
      await turnOffFlag(engineer, { stateId: state.id, reason: "Incident" }),
    ).toMatchObject({ ok: true });

    const approval = await approveApprovalRequest(manager, request.id, "ok");
    expect(approval.ok).toBe(false);
    expect(await stateOf(state.id)).toMatchObject({
      enabled: false,
      rolloutPercent: 10,
    });
    expect(
      (
        await db.approvalRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).status,
    ).toBe("PENDING");

    // The stale request doesn't block a fresh one.
    const again = await changeFlag(engineer, {
      stateId: state.id,
      expectedVersion: 1,
      to: { enabled: true, rolloutPercent: 10 },
      reason: "Fixed, turning back on",
    });
    expect(again.ok).toBe(true);
  });

  it("is a no-op when the flag is already off", async () => {
    const state = await seedState("PRODUCTION", {
      enabled: false,
      rolloutPercent: 0,
    });
    expect(
      await turnOffFlag(engineer, { stateId: state.id, reason: "x" }),
    ).toEqual({ ok: true, message: "Already off" });
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("roles without flag permissions", () => {
  it("are blocked from changing and turning off flags, and it's logged", async () => {
    const staging = await seedState("STAGING", {
      enabled: true,
      rolloutPercent: 100,
    });
    const production = await seedState("PRODUCTION", {
      enabled: true,
      rolloutPercent: 10,
    });

    expect(
      await changeFlag(support, {
        stateId: staging.id,
        expectedVersion: 0,
        to: { enabled: false, rolloutPercent: 100 },
        reason: "x",
      }),
    ).toEqual({ ok: false, error: "You cannot make this change" });
    expect(
      await changeFlag(support, {
        stateId: production.id,
        expectedVersion: 0,
        to: { enabled: true, rolloutPercent: 50 },
        reason: "x",
      }),
    ).toEqual({ ok: false, error: "You cannot make this change" });
    expect(
      await turnOffFlag(support, { stateId: production.id, reason: "x" }),
    ).toEqual({ ok: false, error: "You cannot turn off this flag" });

    expect(await stateOf(staging.id)).toMatchObject({ enabled: true });
    expect(await stateOf(production.id)).toMatchObject({
      enabled: true,
      rolloutPercent: 10,
    });
    expect(await db.approvalRequest.count()).toBe(0);
    const denials = await db.auditLog.findMany({
      where: { actorId: support.id, outcome: "DENIED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(denials.map((d) => [d.action, d.entityId])).toEqual([
      ["flags.change_staging", staging.id],
      ["flags.request_production", production.id],
      ["flags.reduce_production", production.id],
    ]);
  });
});

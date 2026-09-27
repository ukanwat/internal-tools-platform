import "server-only";

import { recordAudit } from "@/platform/audit/record";
import { defineApprovalType } from "@/platform/approvals/types";
import { db } from "@/platform/db";

import { describeSetting, type FlagSetting } from "./rules";
import { flagEntity, flagSnapshot } from "./snapshot";

export const FLAG_PRODUCTION_CHANGE = "flags.production_change";

export type FlagProductionChangePayload = {
  stateId: string;
  flagKey: string;
  from: FlagSetting;
  to: FlagSetting;
  /** The flag's version when requested; the change only applies if nothing changed since. */
  baseVersion: number;
};

function parseSetting(value: unknown, name: string): FlagSetting {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${name} must be an object`);
  }
  const { enabled, rolloutPercent } = value as Record<string, unknown>;
  if (typeof enabled !== "boolean") {
    throw new Error(`${name}.enabled must be a boolean`);
  }
  if (
    typeof rolloutPercent !== "number" ||
    !Number.isInteger(rolloutPercent) ||
    rolloutPercent < 0 ||
    rolloutPercent > 100
  ) {
    throw new Error(`${name}.rolloutPercent must be an integer from 0 to 100`);
  }
  return { enabled, rolloutPercent };
}

/** Turning a production flag on or raising its rollout. */
export const flagProductionChangeType =
  defineApprovalType<FlagProductionChangePayload>({
    key: FLAG_PRODUCTION_CHANGE,
    label: "Production flag change",
    requestPermission: "flags.request_production",
    decidePermission: "flags.approve_production",
    parse(input) {
      if (typeof input !== "object" || input === null) {
        throw new Error("Payload must be an object");
      }
      const { stateId, flagKey, from, to, baseVersion } = input as Record<
        string,
        unknown
      >;
      if (typeof stateId !== "string" || !stateId) {
        throw new Error("stateId is required");
      }
      if (typeof flagKey !== "string" || !flagKey) {
        throw new Error("flagKey is required");
      }
      if (
        typeof baseVersion !== "number" ||
        !Number.isInteger(baseVersion) ||
        baseVersion < 0
      ) {
        throw new Error("baseVersion must be a non-negative integer");
      }
      return {
        stateId,
        flagKey,
        from: parseSetting(from, "from"),
        to: parseSetting(to, "to"),
        baseVersion,
      };
    },
    describe: (p) =>
      `Change ${p.flagKey} in production from ${describeSetting(p.from)} to ${describeSetting(p.to)}`,
    entity: (p) => flagEntity(p.stateId),
    async execute({ payload, request, idempotencyKey }) {
      await db.$transaction(async (tx) => {
        const applied = await tx.featureFlagApproval.findUnique({
          where: { approvalRequestId: idempotencyKey },
        });
        if (applied) return;

        const before = await tx.featureFlagState.findUniqueOrThrow({
          where: { id: payload.stateId },
          include: { flag: { select: { key: true } } },
        });
        const { count } = await tx.featureFlagState.updateMany({
          where: { id: payload.stateId, version: payload.baseVersion },
          data: {
            enabled: payload.to.enabled,
            rolloutPercent: payload.to.rolloutPercent,
            version: { increment: 1 },
            updatedById: request.decidedById,
          },
        });
        if (count === 0) {
          throw new Error(
            `Flag changed after this request was made (version ${before.version}, requested against ${payload.baseVersion})`,
          );
        }
        await tx.featureFlagApproval.create({
          data: {
            approvalRequestId: idempotencyKey,
            stateId: payload.stateId,
          },
        });
        const after = await tx.featureFlagState.findUniqueOrThrow({
          where: { id: payload.stateId },
        });
        const approver = await tx.user.findUniqueOrThrow({
          where: { id: request.decidedById },
          select: { id: true, email: true, name: true, role: true },
        });
        const approval = await tx.approvalRequest.findUniqueOrThrow({
          where: { id: request.id },
          select: { requestReason: true, decisionReason: true },
        });
        await recordAudit(
          {
            actor: approver,
            action: "flags.change",
            entity: flagEntity(payload.stateId),
            before: flagSnapshot(before, before.flag.key),
            after: {
              ...flagSnapshot(after, before.flag.key),
              approvalRequestId: request.id,
              requestedById: request.requestedById,
              requestReason: approval.requestReason,
            },
            reason: approval.decisionReason ?? approval.requestReason,
          },
          tx,
        );
      });
    },
    async checkOutcome({ idempotencyKey }) {
      const applied = await db.featureFlagApproval.findUnique({
        where: { approvalRequestId: idempotencyKey },
      });
      return applied ? "completed" : "failed";
    },
  });

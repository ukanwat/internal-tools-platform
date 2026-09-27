import "server-only";

import type { FlagEnvironment } from "@/generated/prisma/enums";
import {
  createApprovalRequest,
  type ApprovalDeps,
} from "@/platform/approvals/service";
import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import { authorize } from "@/platform/permissions/guard";
import type { Permission } from "@/platform/permissions/policy";

import { FLAG_PRODUCTION_CHANGE } from "./approval-type";
import {
  classifyFlagChange,
  flagChangePermission,
  type FlagSetting,
} from "./rules";
import { flagEntity, flagSnapshot } from "./snapshot";

export type FlagResult =
  { ok: true; message: string } | { ok: false; error: string };

const OPEN_STATUSES = ["PENDING", "PROCESSING", "OUTCOME_UNKNOWN"] as const;

export const STALE_MESSAGE =
  "This flag changed since you opened it. Reload and try again.";

/** Every flag with its per-environment state and any open production requests. */
export async function listFlags() {
  const flags = await db.featureFlag.findMany({
    orderBy: { key: "asc" },
    include: {
      states: {
        orderBy: { environment: "desc" },
        include: { updatedBy: { select: { name: true } } },
      },
    },
  });
  const stateIds = flags.flatMap((f) => f.states.map((s) => s.id));
  const open = await db.approvalRequest.findMany({
    where: {
      type: FLAG_PRODUCTION_CHANGE,
      entityId: { in: stateIds },
      status: { in: [...OPEN_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    include: { requestedBy: { select: { name: true } } },
  });
  return flags.map((flag) => ({
    ...flag,
    states: flag.states.map((state) => ({
      ...state,
      openRequests: open
        .filter((r) => r.entityId === state.id)
        .map((r) => ({
          id: r.id,
          summary: r.summary,
          status: r.status,
          requestedBy: r.requestedBy.name,
          createdAt: r.createdAt,
          /** Made against an older version, so approving it will fail. */
          stale: baseVersionOf(r.payload) !== state.version,
        })),
    })),
  }));
}

function baseVersionOf(payload: unknown): number | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "baseVersion" in payload &&
    typeof payload.baseVersion === "number"
  ) {
    return payload.baseVersion;
  }
  return null;
}

export type FlagChangeInput = {
  stateId: string;
  /** The version the user was looking at; the change is refused if it moved on. */
  expectedVersion: number;
  to: FlagSetting;
  reason: string;
};

async function loadState(stateId: string) {
  return db.featureFlagState.findUnique({
    where: { id: stateId },
    include: { flag: { select: { key: true } } },
  });
}

/**
 * The permission needed for a change, based on the flag's current state.
 * Null if the flag doesn't exist or nothing would change.
 */
export async function flagChangePermissionFor(
  input: Pick<FlagChangeInput, "stateId" | "to">,
): Promise<Permission | null> {
  const state = await loadState(input.stateId);
  if (!state) return null;
  const kind = classifyFlagChange(state.environment, state, input.to);
  return kind === "unchanged"
    ? null
    : flagChangePermission(state.environment, kind);
}

export function flagTurnOffPermission(environment: FlagEnvironment) {
  return flagChangePermission(environment, "apply");
}

/**
 * Applies a change straight away, or sends it for approval when production
 * exposure goes up. Refused if the flag moved on from `expectedVersion`.
 */
export async function changeFlag(
  actor: CurrentUser,
  input: FlagChangeInput,
  deps: ApprovalDeps = {},
): Promise<FlagResult> {
  const state = await loadState(input.stateId);
  if (!state) return { ok: false, error: "Flag not found" };
  if (state.version !== input.expectedVersion) {
    return { ok: false, error: STALE_MESSAGE };
  }

  const kind = classifyFlagChange(state.environment, state, input.to);
  if (kind === "unchanged") return { ok: false, error: "Nothing to change" };

  const entity = flagEntity(state.id);
  const auth = await authorize(
    actor,
    flagChangePermission(state.environment, kind),
    entity,
  );
  if (!auth.ok) return { ok: false, error: "You cannot make this change" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required" };

  if (kind === "approval") {
    const open = await db.approvalRequest.findMany({
      where: {
        type: FLAG_PRODUCTION_CHANGE,
        entityId: state.id,
        status: { in: [...OPEN_STATUSES] },
      },
      select: { payload: true },
    });
    if (open.some((r) => baseVersionOf(r.payload) === state.version)) {
      return {
        ok: false,
        error: "A change to this flag is already waiting for approval",
      };
    }
    const result = await createApprovalRequest(
      actor,
      {
        type: FLAG_PRODUCTION_CHANGE,
        payload: {
          stateId: state.id,
          flagKey: state.flag.key,
          from: {
            enabled: state.enabled,
            rolloutPercent: state.rolloutPercent,
          },
          to: input.to,
          baseVersion: state.version,
        },
        reason,
      },
      deps,
    );
    return result.ok
      ? { ok: true, message: "Sent to an eng manager for approval" }
      : { ok: false, error: "The request could not be created" };
  }

  const applied = await db.$transaction(async (tx) => {
    const { count } = await tx.featureFlagState.updateMany({
      where: { id: state.id, version: state.version },
      data: {
        enabled: input.to.enabled,
        rolloutPercent: input.to.rolloutPercent,
        version: { increment: 1 },
        updatedById: actor.id,
      },
    });
    if (count === 0) return false;
    const after = await tx.featureFlagState.findUniqueOrThrow({
      where: { id: state.id },
    });
    await recordAudit(
      {
        actor,
        action: "flags.change",
        entity,
        before: flagSnapshot(state, state.flag.key),
        after: flagSnapshot(after, state.flag.key),
        reason,
      },
      tx,
    );
    return true;
  });
  return applied
    ? { ok: true, message: "Flag updated" }
    : { ok: false, error: STALE_MESSAGE };
}

/**
 * The kill switch: turns a flag off straight away in any environment, whatever
 * else is in flight. Pending requests made before it can no longer be applied.
 */
export async function turnOffFlag(
  actor: CurrentUser,
  input: { stateId: string; reason: string },
): Promise<FlagResult> {
  const state = await loadState(input.stateId);
  if (!state) return { ok: false, error: "Flag not found" };

  const entity = flagEntity(state.id);
  const auth = await authorize(
    actor,
    flagTurnOffPermission(state.environment),
    entity,
  );
  if (!auth.ok) return { ok: false, error: "You cannot turn off this flag" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required" };

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM feature_flag_states WHERE id = ${state.id} FOR UPDATE`;
    const before = await tx.featureFlagState.findUniqueOrThrow({
      where: { id: state.id },
    });
    const pending = await tx.approvalRequest.count({
      where: {
        type: FLAG_PRODUCTION_CHANGE,
        entityId: state.id,
        status: { in: [...OPEN_STATUSES] },
      },
    });
    if (!before.enabled && pending === 0) return "already_off" as const;
    const after = await tx.featureFlagState.update({
      where: { id: state.id },
      data: {
        enabled: false,
        version: { increment: 1 },
        updatedById: actor.id,
      },
    });
    await recordAudit(
      {
        actor,
        action: "flags.turn_off",
        entity,
        before: flagSnapshot(before, state.flag.key),
        after: flagSnapshot(after, state.flag.key),
        reason,
      },
      tx,
    );
    return before.enabled ? ("turned_off" as const) : ("cancelled" as const);
  });
  const messages = {
    turned_off: "Flag turned off",
    cancelled: "Already off. Pending requests can no longer be applied",
    already_off: "Already off",
  };
  return { ok: true, message: messages[outcome] };
}

import "server-only";

import type { ApprovalRequest, Prisma } from "@/generated/prisma/client";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { approvalProcessingTimeoutMs } from "@/platform/config";
import { db } from "@/platform/db";
import { getIntegrations, type Integrations } from "@/platform/integrations";
import { authorize } from "@/platform/permissions/guard";
import { TimeoutError, withTimeout } from "@/platform/timeout";

import { approvalRegistry, type ApprovalRegistry } from "./registry";
import type { ApprovalExecutionContext } from "./types";

export type ApprovalDeps = {
  registry?: ApprovalRegistry;
  integrations?: Integrations;
  now?: () => Date;
  processingTimeoutMs?: number;
};

export type ApprovalResult =
  { ok: true; request: ApprovalRequest } | { ok: false; error: string };

function resolveDeps(deps: ApprovalDeps) {
  return {
    registry: deps.registry ?? approvalRegistry,
    integrations: deps.integrations ?? getIntegrations(),
    now: deps.now ?? (() => new Date()),
    processingTimeoutMs:
      deps.processingTimeoutMs ?? approvalProcessingTimeoutMs(),
  };
}

const auditEntity = (id: string) => ({ type: "ApprovalRequest", id });

function snapshot(request: ApprovalRequest) {
  return {
    type: request.type,
    status: request.status,
    summary: request.summary,
    entityType: request.entityType,
    entityId: request.entityId,
    requestedById: request.requestedById,
    decidedById: request.decidedById,
    decisionReason: request.decisionReason,
    lastError: request.lastError,
    attempts: request.attempts,
  };
}

async function deny(
  actor: CurrentUser,
  action: string,
  requestId: string,
  reason: string,
): Promise<{ ok: false; error: string }> {
  await recordAudit({
    actor,
    action,
    outcome: "DENIED",
    entity: auditEntity(requestId),
    reason,
  });
  return { ok: false, error: reason };
}

/**
 * Pass `tx` to create the request inside the caller's transaction, so a tool's
 * own record and its approval request are written together.
 */
export async function createApprovalRequest(
  actor: CurrentUser,
  input: { type: string; payload: unknown; reason: string },
  deps: ApprovalDeps = {},
  tx?: Prisma.TransactionClient,
): Promise<ApprovalResult> {
  const { registry } = resolveDeps(deps);
  const type = registry.get(input.type);
  if (!type) return { ok: false, error: `Unknown approval type ${input.type}` };

  const auth = await authorize(actor, type.requestPermission);
  if (!auth.ok) return { ok: false, error: "You cannot make this request" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required" };

  let prepared: ReturnType<typeof type.prepare>;
  try {
    prepared = type.prepare(input.payload);
  } catch (error) {
    return { ok: false, error: `Invalid request: ${errorMessage(error)}` };
  }

  const write = async (client: Prisma.TransactionClient) => {
    const refusal = await type.checkRequest({
      tx: client,
      payload: prepared.payload,
      actor,
    });
    if (refusal) throw new RequestRefused(refusal);
    const created = await client.approvalRequest.create({
      data: {
        type: type.key,
        payload: JSON.parse(JSON.stringify(prepared.payload)),
        summary: prepared.summary,
        entityType: prepared.entity?.type,
        entityId: prepared.entity?.id,
        requestedById: actor.id,
        requestReason: reason,
      },
    });
    await recordAudit(
      {
        actor,
        action: "approvals.request",
        entity: auditEntity(created.id),
        after: snapshot(created),
        reason,
      },
      client,
    );
    return created;
  };
  let request: ApprovalRequest;
  try {
    request = tx ? await write(tx) : await db.$transaction(write);
  } catch (error) {
    if (error instanceof RequestRefused) {
      await recordAudit({
        actor,
        action: "approvals.request",
        outcome: "DENIED",
        entity: prepared.entity,
        reason: error.message,
      });
      return { ok: false, error: error.message };
    }
    throw error;
  }
  return { ok: true, request };
}

/** Thrown inside the create transaction to roll it back when a type refuses the request. */
class RequestRefused extends Error {}

/** Loads a request's type so callers can check its decide permission first. */
export async function getApprovalDecidePermission(
  requestId: string,
  deps: ApprovalDeps = {},
) {
  const { registry } = resolveDeps(deps);
  const request = await db.approvalRequest.findUnique({
    where: { id: requestId },
    select: { type: true },
  });
  return request ? registry.get(request.type)?.decidePermission : undefined;
}

type Decision = "approve" | "reject";

/** Shared checks for approve/reject. Every block is logged before returning. */
async function checkDecision(
  actor: CurrentUser,
  requestId: string,
  decision: Decision,
  rawReason: string,
  registry: ApprovalRegistry,
) {
  const action = `approvals.${decision}`;
  const request = await db.approvalRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return { ok: false as const, error: "Request not found" };

  const type = registry.get(request.type);
  if (!type) {
    return {
      ok: false as const,
      error: (
        await deny(
          actor,
          action,
          requestId,
          `Unknown approval type ${request.type}`,
        )
      ).error,
    };
  }

  const auth = await authorize(
    actor,
    type.decidePermission,
    auditEntity(requestId),
  );
  if (!auth.ok)
    return { ok: false as const, error: "You cannot decide this request" };

  if (request.requestedById === actor.id) {
    await deny(actor, action, requestId, "Cannot decide your own request");
    return { ok: false as const, error: "You cannot decide your own request" };
  }

  if (request.status !== "PENDING") {
    await deny(
      actor,
      action,
      requestId,
      `Request is ${request.status}, not PENDING`,
    );
    return {
      ok: false as const,
      error:
        request.status === "OUTCOME_UNKNOWN"
          ? "This request's outcome is still being confirmed"
          : `Request is already ${request.status.toLowerCase()}`,
    };
  }

  const reason = rawReason.trim();
  if (!reason) return { ok: false as const, error: "A reason is required" };

  return { ok: true as const, request, type, reason, action };
}

export async function rejectApprovalRequest(
  actor: CurrentUser,
  requestId: string,
  reason: string,
  deps: ApprovalDeps = {},
): Promise<ApprovalResult> {
  const { registry, now } = resolveDeps(deps);
  await settleApprovals(deps);

  const check = await checkDecision(
    actor,
    requestId,
    "reject",
    reason,
    registry,
  );
  if (!check.ok) return check;

  const updated = await db.$transaction(async (tx) => {
    const { count } = await tx.approvalRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "REJECTED",
        decidedById: actor.id,
        decisionReason: check.reason,
        decidedAt: now(),
      },
    });
    if (count === 0) return null;
    const after = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await recordAudit(
      {
        actor,
        action: check.action,
        entity: auditEntity(requestId),
        before: snapshot(check.request),
        after: snapshot(after),
        reason: check.reason,
      },
      tx,
    );
    return after;
  });

  if (!updated) {
    return deny(
      actor,
      check.action,
      requestId,
      "Request was decided concurrently",
    );
  }
  return { ok: true, request: updated };
}

export async function approveApprovalRequest(
  actor: CurrentUser,
  requestId: string,
  reason: string,
  deps: ApprovalDeps = {},
): Promise<ApprovalResult> {
  const { registry, integrations, now, processingTimeoutMs } =
    resolveDeps(deps);
  await settleApprovals(deps);

  const check = await checkDecision(
    actor,
    requestId,
    "approve",
    reason,
    registry,
  );
  if (!check.ok) return check;

  const startedAt = now();
  const claimed = await db.$transaction(async (tx) => {
    const { count } = await tx.approvalRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "PROCESSING",
        processingStartedAt: startedAt,
        decidedById: actor.id,
        decisionReason: check.reason,
        decidedAt: startedAt,
        lastError: null,
        attempts: { increment: 1 },
      },
    });
    if (count === 0) return null;
    const after = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await recordAudit(
      {
        actor,
        action: check.action,
        entity: auditEntity(requestId),
        before: snapshot(check.request),
        after: snapshot(after),
        reason: check.reason,
      },
      tx,
    );
    return after;
  });

  if (!claimed) {
    return deny(
      actor,
      check.action,
      requestId,
      "Request was decided concurrently",
    );
  }

  const execution = Promise.resolve().then(() =>
    check.type.execute(executionContext(claimed, integrations)),
  );
  try {
    await withTimeout(
      execution,
      processingTimeoutMs,
      timeoutReason(processingTimeoutMs),
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      await markOutcomeUnknown(claimed, error.message, actor);
      void execution
        .then(
          () => {},
          () => {},
        )
        .then(() => settleOne(requestId, registry, integrations, now))
        .catch((settleError) => console.error(settleError));
      return {
        ok: false,
        error: `Approved, but ${lowerFirst(TIMEOUT_MESSAGE)}`,
      };
    }
    await markFailed(claimed, errorMessage(error), actor);
    return {
      ok: false,
      error: `Approved, but ${lowerFirst(FAILURE_MESSAGE)}`,
    };
  }

  const completed = await transition(
    claimed,
    "PROCESSING",
    { status: "COMPLETED", completedAt: now() },
    { actor, action: "approvals.complete" },
  );
  if (completed) return { ok: true, request: completed };

  // The request timed out while this execution was still running.
  const settled = await settleOne(requestId, registry, integrations, now);
  return settled?.status === "COMPLETED"
    ? { ok: true, request: settled }
    : { ok: false, error: `Approved, but ${lowerFirst(TIMEOUT_MESSAGE)}` };
}

/** Shown to users; the underlying error is kept in the audit log only. */
const FAILURE_MESSAGE = "Processing failed. The request is back to pending.";
const TIMEOUT_MESSAGE =
  "Processing timed out. It will be completed or returned to pending once its outcome is known.";

function executionContext(
  request: ApprovalRequest,
  integrations: Integrations,
): ApprovalExecutionContext<unknown> {
  if (!request.decidedById) throw new Error("Request has no decider");
  return {
    request: {
      id: request.id,
      requestedById: request.requestedById,
      decidedById: request.decidedById,
    },
    payload: request.payload,
    idempotencyKey: request.id,
    integrations,
  };
}

/**
 * Moves a request out of `from` and audits it. No-op (returns null) if the
 * request already moved on, e.g. because another path settled it first.
 */
async function transition(
  request: ApprovalRequest,
  from: ApprovalStatus,
  data: Prisma.ApprovalRequestUpdateManyMutationInput,
  audit: {
    actor: CurrentUser | null;
    action: string;
    outcome?: "SUCCESS" | "FAILURE";
    reason?: string;
  },
): Promise<ApprovalRequest | null> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        status: from,
        processingStartedAt: request.processingStartedAt,
      },
      data,
    });
    if (count === 0) return null;
    const after = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    await recordAudit(
      {
        ...audit,
        entity: auditEntity(request.id),
        before: snapshot(request),
        after: snapshot(after),
      },
      tx,
    );
    return after;
  });
}

const backToPending = {
  status: "PENDING",
  lastError: FAILURE_MESSAGE,
  processingStartedAt: null,
  decidedById: null,
  decisionReason: null,
  decidedAt: null,
} as const;

function markFailed(
  request: ApprovalRequest,
  error: string,
  actor: CurrentUser | null,
) {
  return transition(request, "PROCESSING", backToPending, {
    actor,
    action: "approvals.fail",
    outcome: "FAILURE",
    reason: error,
  });
}

/** A timed-out request can't be decided again until its outcome is known. */
function markOutcomeUnknown(
  request: ApprovalRequest,
  reason: string,
  actor: CurrentUser | null,
) {
  return transition(
    request,
    "PROCESSING",
    { status: "OUTCOME_UNKNOWN", lastError: TIMEOUT_MESSAGE },
    { actor, action: "approvals.outcome_unknown", outcome: "FAILURE", reason },
  );
}

/** Asks the approval type whether a timed-out execution took effect. */
async function settleOutcome(
  request: ApprovalRequest,
  registry: ApprovalRegistry,
  integrations: Integrations,
  now: () => Date,
): Promise<ApprovalRequest | null> {
  const type = registry.get(request.type);
  if (!type) return null;
  let outcome: Awaited<ReturnType<typeof type.checkOutcome>>;
  try {
    outcome = await type.checkOutcome(executionContext(request, integrations));
  } catch {
    return null;
  }
  if (outcome === "completed") {
    return transition(
      request,
      "OUTCOME_UNKNOWN",
      { status: "COMPLETED", completedAt: now(), lastError: null },
      {
        actor: null,
        action: "approvals.complete",
        reason: "Confirmed as completed after timing out",
      },
    );
  }
  if (outcome === "failed") {
    return transition(request, "OUTCOME_UNKNOWN", backToPending, {
      actor: null,
      action: "approvals.fail",
      outcome: "FAILURE",
      reason: "Confirmed as not applied after timing out",
    });
  }
  return null;
}

async function settleOne(
  requestId: string,
  registry: ApprovalRegistry,
  integrations: Integrations,
  now: () => Date,
) {
  const request = await db.approvalRequest.findUnique({
    where: { id: requestId },
  });
  if (request?.status !== "OUTCOME_UNKNOWN") return request;
  return (await settleOutcome(request, registry, integrations, now)) ?? request;
}

/**
 * Marks requests stuck in PROCESSING past the timeout as OUTCOME_UNKNOWN, then
 * completes or reopens every OUTCOME_UNKNOWN request whose outcome is now known.
 */
export async function settleApprovals(
  deps: ApprovalDeps = {},
): Promise<{ timedOut: number; settled: number }> {
  const { registry, integrations, now, processingTimeoutMs } =
    resolveDeps(deps);
  const cutoff = new Date(now().getTime() - processingTimeoutMs);
  const stale = await db.approvalRequest.findMany({
    where: { status: "PROCESSING", processingStartedAt: { lt: cutoff } },
  });
  for (const request of stale) {
    await markOutcomeUnknown(request, timeoutReason(processingTimeoutMs), null);
  }

  const unknown = await db.approvalRequest.findMany({
    where: { status: "OUTCOME_UNKNOWN" },
  });
  let settled = 0;
  for (const request of unknown) {
    if (await settleOutcome(request, registry, integrations, now)) settled++;
  }
  return { timedOut: stale.length, settled };
}

function timeoutReason(ms: number) {
  return `Timed out after ${Math.round(ms / 1000)}s in processing`;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

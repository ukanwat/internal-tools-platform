import "server-only";

import type { ApprovalRequest } from "@/generated/prisma/client";
import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { approvalProcessingTimeoutMs } from "@/platform/config";
import { db } from "@/platform/db";
import { getIntegrations, type Integrations } from "@/platform/integrations";
import { authorize } from "@/platform/permissions/guard";

import { approvalRegistry, type ApprovalRegistry } from "./registry";

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

export async function createApprovalRequest(
  actor: CurrentUser,
  input: { type: string; payload: unknown; reason: string },
  deps: ApprovalDeps = {},
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

  const request = await db.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
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
      tx,
    );
    return created;
  });
  return { ok: true, request };
}

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
      error: `Request is already ${request.status.toLowerCase()}`,
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
  await failStaleApprovals(deps);

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
  await failStaleApprovals(deps);

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

  try {
    await withTimeout(
      check.type.execute({
        request: {
          id: claimed.id,
          requestedById: claimed.requestedById,
          decidedById: actor.id,
        },
        payload: claimed.payload,
        idempotencyKey: claimed.id,
        integrations,
      }),
      processingTimeoutMs,
    );
  } catch (error) {
    const failed = await markFailed(claimed, errorMessage(error), actor);
    return {
      ok: false,
      error: `Approved, but processing failed: ${failed.lastError}`,
    };
  }

  const completed = await db.$transaction(async (tx) => {
    const { count } = await tx.approvalRequest.updateMany({
      where: {
        id: requestId,
        status: "PROCESSING",
        processingStartedAt: startedAt,
      },
      data: { status: "COMPLETED", completedAt: now() },
    });
    if (count === 0) return null;
    const after = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await recordAudit(
      {
        actor,
        action: "approvals.complete",
        entity: auditEntity(requestId),
        before: snapshot(claimed),
        after: snapshot(after),
      },
      tx,
    );
    return after;
  });

  if (!completed) {
    await recordAudit({
      actor,
      action: "approvals.complete",
      outcome: "FAILURE",
      entity: auditEntity(requestId),
      reason: "Processing finished after the request had already timed out",
    });
    return {
      ok: false,
      error: "Processing finished after the request timed out",
    };
  }
  return { ok: true, request: completed };
}

/**
 * Moves a PROCESSING request back to PENDING with the error, and logs it.
 * No-op if another path already moved it.
 */
async function markFailed(
  request: ApprovalRequest,
  error: string,
  actor: CurrentUser | null,
): Promise<ApprovalRequest> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        status: "PROCESSING",
        processingStartedAt: request.processingStartedAt,
      },
      data: {
        status: "PENDING",
        lastError: error,
        processingStartedAt: null,
        decidedById: null,
        decisionReason: null,
        decidedAt: null,
      },
    });
    const after = await tx.approvalRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    if (count > 0) {
      await recordAudit(
        {
          actor,
          action: "approvals.fail",
          outcome: "FAILURE",
          entity: auditEntity(request.id),
          before: snapshot(request),
          after: snapshot(after),
          reason: error,
        },
        tx,
      );
    }
    return after;
  });
}

/** Treats requests stuck in PROCESSING past the timeout as failed. Returns how many. */
export async function failStaleApprovals(
  deps: ApprovalDeps = {},
): Promise<number> {
  const { now, processingTimeoutMs } = resolveDeps(deps);
  const cutoff = new Date(now().getTime() - processingTimeoutMs);
  const stale = await db.approvalRequest.findMany({
    where: { status: "PROCESSING", processingStartedAt: { lt: cutoff } },
  });
  for (const request of stale) {
    await markFailed(
      request,
      `Timed out after ${Math.round(processingTimeoutMs / 1000)}s in processing`,
      null,
    );
  }
  return stale.length;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`Timed out after ${Math.round(ms / 1000)}s in processing`),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

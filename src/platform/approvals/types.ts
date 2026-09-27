import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/platform/auth/types";
import type { Integrations } from "@/platform/integrations";
import type { Permission } from "@/platform/permissions/policy";

export type ApprovalEntity = { type: string; id: string };

export type ApprovalExecutionContext<TPayload> = {
  request: { id: string; requestedById: string; decidedById: string };
  payload: TPayload;
  /** Stable per request, so a retried execution is not applied twice. */
  idempotencyKey: string;
  integrations: Integrations;
};

export type ApprovalRequestCheckContext<TPayload> = {
  /** The transaction that will create the request; lock rows with it. */
  tx: Prisma.TransactionClient;
  payload: TPayload;
  actor: CurrentUser;
};

export type ApprovalTypeDefinition<TPayload> = {
  /** Unique key, e.g. `refunds.issue`. */
  key: string;
  label: string;
  requestPermission: Permission;
  decidePermission: Permission;
  /** Validates untrusted input. Throw to reject it. */
  parse: (input: unknown) => TPayload;
  describe: (payload: TPayload) => string;
  entity?: (payload: TPayload) => ApprovalEntity;
  /**
   * Runs inside the transaction that creates the request, so it can check the
   * record's current state (e.g. still open, no other request in flight).
   * Return a user-facing message to refuse the request.
   */
  checkRequest?: (
    ctx: ApprovalRequestCheckContext<TPayload>,
  ) => Promise<string | null>;
  /** Runs after approval. Throw to put the request back to pending with the error. */
  execute: (ctx: ApprovalExecutionContext<TPayload>) => Promise<void>;
  /**
   * After `execute` timed out, reports whether it took effect, usually by
   * looking up `idempotencyKey` in the integration. Return null if still unknown.
   */
  checkOutcome: (
    ctx: ApprovalExecutionContext<TPayload>,
  ) => Promise<ApprovalOutcome | null>;
};

export type ApprovalOutcome = "completed" | "failed";

/** A definition with its payload type erased, as stored in the registry. */
export type ApprovalType = {
  key: string;
  label: string;
  requestPermission: Permission;
  decidePermission: Permission;
  prepare: (input: unknown) => {
    payload: unknown;
    summary: string;
    entity: ApprovalEntity | undefined;
  };
  checkRequest: (
    ctx: ApprovalRequestCheckContext<unknown>,
  ) => Promise<string | null>;
  execute: (ctx: ApprovalExecutionContext<unknown>) => Promise<void>;
  checkOutcome: (
    ctx: ApprovalExecutionContext<unknown>,
  ) => Promise<ApprovalOutcome | null>;
};

export function defineApprovalType<TPayload>(
  definition: ApprovalTypeDefinition<TPayload>,
): ApprovalType {
  return {
    key: definition.key,
    label: definition.label,
    requestPermission: definition.requestPermission,
    decidePermission: definition.decidePermission,
    prepare(input) {
      const payload = definition.parse(input);
      return {
        payload,
        summary: definition.describe(payload),
        entity: definition.entity?.(payload),
      };
    },
    async checkRequest(ctx) {
      if (!definition.checkRequest) return null;
      return definition.checkRequest({
        ...ctx,
        payload: definition.parse(ctx.payload),
      });
    },
    execute(ctx) {
      return definition.execute({
        ...ctx,
        payload: definition.parse(ctx.payload),
      });
    },
    checkOutcome(ctx) {
      return definition.checkOutcome({
        ...ctx,
        payload: definition.parse(ctx.payload),
      });
    },
  };
}

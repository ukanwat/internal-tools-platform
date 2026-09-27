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

# Building a tool

How to add a tool to the ops console and use the platform APIs it builds on. Coding agents should follow the `add-internal-tool` skill in `.agents/skills/add-internal-tool/SKILL.md`, which has the full rules and checklist.

## Checklist

1. Write the tool's rules first (who views, requests, decides; what needs approval; sensitive fields;
   config limits; outside systems) and list them in the PR description.
2. Add models to `prisma/schema.prisma` and a migration.
3. Add `<tool>.<verb>` permissions to `PERMISSIONS` / `ROLE_PERMISSIONS` and labels in
   `src/platform/audit/labels.ts`.
4. Put the code under `src/tools/<tool>/` (actions, service, approval type, components) and the page
   under `src/app/(app)/<tool>/page.tsx`. Tools import from `src/platform`, never the other way round.
5. Give the tool an `href` in `TOOLS` (`src/platform/tools.ts`) so it shows in the sidebar.
6. Write a test for every rule, then run `npm run lint && npm run typecheck && npm test && npm run build`.

## Permissions and audit

Every server action (and every gated page) starts with `requirePermission`. It returns the
signed-in user, or writes a `DENIED` audit entry and then blocks the request. Hiding a button is
not a permission check. A test fails if an exported server action doesn't call it.

Write the change and its audit entry in one transaction:

```ts
"use server";

export async function approveRefund(refundId: string, reason: string) {
  const user = await requirePermission("refunds.approve", {
    type: "Refund",
    id: refundId,
  });
  await db.$transaction(async (tx) => {
    const before = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
    });
    const after = await tx.refund.update({
      where: { id: refundId },
      data: { status: "APPROVED" },
    });
    await recordAudit(
      {
        actor: user,
        action: "refunds.approve",
        entity: { type: "Refund", id: refundId },
        before,
        after,
        reason,
      },
      tx,
    );
  });
}
```

The audit log is append-only (a database trigger rejects `UPDATE` and `DELETE`). Admins and
compliance leads can view it at `/admin/audit`.

## Approvals

A tool that needs a second person to sign off defines an approval type and adds it to the
registry in `src/platform/approvals/registry.ts`:

```ts
export const refundApproval = defineApprovalType<RefundPayload>({
  key: "refunds.issue",
  label: "Refund",
  requestPermission: "refunds.request",
  decidePermission: "refunds.approve",
  parse: parseRefundPayload, // throw on invalid input
  describe: (p) => `Refund ${p.amountMinor} ${p.currency} on ${p.paymentId}`,
  entity: (p) => ({ type: "Payment", id: p.paymentId }),
  execute: ({ payload, idempotencyKey, integrations }) =>
    integrations.payments.refund({ idempotencyKey, ...payload }).then(() => {}),
  checkOutcome: async ({ idempotencyKey, integrations }) => {
    const refund = await integrations.payments.findRefund(idempotencyKey);
    if (!refund || refund.status === "failed") return "failed";
    return refund.status === "succeeded" ? "completed" : null; // null: still in flight
  },
});
```

The tool then calls `createApprovalRequest(user, { type, payload, reason })`. On approval the
request is marked `PROCESSING`, then `execute` runs:

- If `execute` throws, the request goes back to `PENDING` and the failure is logged.
- If `execute` runs longer than `APPROVAL_PROCESSING_TIMEOUT_MS` (default 5 minutes), the request is
  marked `OUTCOME_UNKNOWN`. Nobody can approve or reject it in that state. Once the late execution
  finishes, or on the next `settleApprovals` sweep (which runs whenever `/approvals` loads or a
  request is decided), `checkOutcome` decides where it goes: `COMPLETED` if it went through,
  `PENDING` if it definitely didn't. While the outcome can still change, `checkOutcome` returns
  `null` and the request stays `OUTCOME_UNKNOWN`. Requests left in `PROCESSING` past the timeout are treated the same way.

Users only see a generic error message. The raw error goes in the audit log, and record history
hides it, and denied attempts, from anyone without `audit.view`. Nobody can decide their own
request. Every block writes a `DENIED` audit entry first, the same way `requirePermission` does.
`execute` receives the request id as `idempotencyKey`, so a retry never pays twice.

## Sensitive fields

`SENSITIVE_FIELDS` in `src/platform/sensitive/fields.ts` lists each sensitive field (for example
`accountNumber` or `idNumber`) and the permission needed to reveal it. The raw value stays on the
server. Pages pass `toSensitiveView(user, field, entity, value)` to `<SensitiveValue>`, and the
browser only ever receives the masked value (`••••6819`). Users with the reveal permission can
click Reveal and must give a reason. The value is returned only after a `sensitive.reveal` audit
entry records who looked, at which record, and why. A reveal attempt without the permission is
logged as `DENIED`.

To support reveals, a tool registers a loader for its record type in `sensitiveSources`
(`src/platform/sensitive/sources.ts`). The loader receives the current user and returns null for records that user may not open. `recordAudit` masks every property named in
`SENSITIVE_FIELDS`, at any depth, so the audit log never stores these values in the clear.

## Attachments

A tool that accepts files registers a policy for its record type in `attachmentPolicies`
(`src/platform/attachments/policies.ts`). The tool decides who may see and add files; the
platform enforces it:

```ts
{
  entityType: "KycCase",
  viewPermission: "kyc.view", // role check, denial logged by authorize()
  uploadPermission: "kyc.review",
  canView: (caseId, actor) => canOpenCase(caseId, actor), // record-level check
  canUpload: (caseId, actor) => isOpen(caseId),
  allowedTypes: ["application/pdf", "image/jpeg"], // default: PDF, PNG, JPEG
  maxBytes: 5 * 1024 * 1024, // default and maximum: 10 MB
}
```

Pages render `<Attachments viewer={user} entity={{ type: "KycCase", id }} />` from
`src/platform/ui/attachments.tsx`: it lists the record's files for viewers the policy allows and
shows the upload form to users who may upload. Downloads go through `/api/attachments/<id>`, which
checks the role permission and then `canView` before serving the file.

- The file type comes from the file's contents, not its name or the browser's claim. Names are
  sanitized, and files are always served as downloads (`Content-Disposition: attachment`, `nosniff`).
- Every upload writes an `attachments.upload` entry (in the same transaction as the file row) and
  every download writes an `attachments.download` entry before the bytes are sent, both on the
  record so they appear in its history. Role and policy denials are logged as `DENIED`.
- Files can't be deleted or replaced. The platform has no delete API, storage is write-once, and a
  database trigger rejects `UPDATE` and `DELETE` on `attachments`. Downloads check the stored
  SHA-256 and refuse files that don't match.
- Files are stored on local disk under `ATTACHMENTS_STORAGE_DIR` (default `.data/attachments`).
  To use object storage instead, change `getFileStorage()` in `src/platform/integrations/storage`.

# Internal Tools Platform

Next.js (App Router, TypeScript) + Tailwind CSS + shadcn/ui, Prisma with PostgreSQL, Vitest.

## Requirements

- Node.js 24 (see `.nvmrc`) — npm 11+ is required
- Docker (for the local Postgres database)

## Getting started

```bash
cp .env.example .env
docker compose up -d && npm install && npm run db:setup && npm run dev
```

The app runs at http://localhost:3000. Sign in with the "sign in as" picker; `db:setup` seeds one user per role.

## Scripts

| Script                | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                         |
| `npm run build`       | Production build                                     |
| `npm run start`       | Serve the production build                           |
| `npm run lint`        | ESLint                                               |
| `npm run typecheck`   | TypeScript type check                                |
| `npm test`            | Run tests once (Vitest; needs Postgres running)      |
| `npm run test:watch`  | Run tests in watch mode                              |
| `npm run format`      | Format with Prettier                                 |
| `npm run db:setup`    | Apply migrations, generate Prisma Client, seed users |
| `npm run db:migrate`  | Create/apply a migration after editing the schema    |
| `npm run db:generate` | Regenerate Prisma Client                             |
| `npm run db:seed`     | Upsert the seeded users                              |
| `npm run db:studio`   | Open Prisma Studio                                   |

## Project layout

- `src/app` — Next.js routes
- `src/components/ui` — shadcn/ui components (add more with `npx shadcn@latest add <component>`)
- `src/platform` — shared code every tool uses:
  - `auth` — fake "sign in as" login and signed session cookie (swap for SSO here)
  - `permissions` — `ROLE_PERMISSIONS` map and `requirePermission()`
  - `audit` — `recordAudit()` and the audit log queries/components
  - `approvals` — second-person sign-off: request, approve/reject with a reason, `/approvals` page
  - `integrations` — the only way to reach outside systems (`payments` is a mock for now)
  - `attachments` — files on a tool's records: stored write-once, downloads checked against the tool's policy, every upload and download audited
  - `sensitive` — masked fields (account/ID numbers) and audited, reason-required reveals
  - `ui` — shared page header, data table, filter bar, status badges, record history, attachments
  - `config.ts` — platform settings read from the environment
  - `db` — shared Prisma Client instance
- `prisma/schema.prisma` — database schema; `prisma.config.ts` — Prisma CLI config
- `src/generated/prisma` — generated Prisma Client (git-ignored, created on `npm install`)

## Building a tool

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
  maxBytes: 5 * 1024 * 1024, // default: 10 MB
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

## Tests

Unit tests run in jsdom. `*.db.test.ts` files run against a separate `<db>_test` database, which
is created and migrated automatically, so `docker compose up -d` must be running.

## CI

GitHub Actions runs lint, typecheck, tests (against a Postgres service) and build on every pull request.

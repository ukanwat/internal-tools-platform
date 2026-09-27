---
name: add-internal-tool
description: How to add a new internal tool (refunds, KYC review, ...) to the ops console using the shared platform in src/platform. Use whenever you build or change a tool.
---

# Adding an internal tool

Tools are thin. Auth, permissions, audit, approvals, masking, integrations and UI
live in `src/platform`; a tool wires them together. If you need something the
platform lacks, add it to the platform, not the tool.

## The rules (and why)

1. **Permissions are checked on the server.** Every server action and protected
   page starts with `requirePermission(...)` (`src/platform/permissions/guard.ts`).
   Hiding a button is only cosmetic: server actions are public POST endpoints, so
   anyone can call them.
2. **Blocked attempts are logged.** `requirePermission` / `authorize` write a
   `DENIED` audit entry before blocking. Don't catch the error and carry on. If you
   write a denial of your own, log it the same way, like `deny()` in
   `src/platform/approvals/service.ts`. We need to show who tried what.
3. **Every change is audited with before, after and a reason.** Use
   `recordAudit(entry, tx)` (`src/platform/audit/record.ts`) inside the **same**
   `db.$transaction` as the change, so a change never exists without its entry.
   Require a reason for any user-initiated change.
4. **Sensitive actions go through approvals, and nobody approves their own.**
   Anything that moves money or decides a customer's status is an approval type
   (`src/platform/approvals`). Self-approval and double decisions are already
   blocked there. Never add a shortcut around it.
5. **Limits go in config.** Amounts, thresholds and timeouts belong in
   `src/platform/config.ts` (env-backed with a safe default, and listed in
   `.env.example`), never hard-coded. Finance and compliance own those numbers and
   change them without a code change.
6. **Outside systems only through `src/platform/integrations`.** Tools get an
   `Integrations` object (`src/platform/integrations/index.ts`) and never import a
   vendor SDK or call `fetch` directly. The payments client
   (`src/platform/integrations/payments`) is currently a mock. Add a new system as a
   typed client with a mock first.
7. **Sensitive fields are masked on the server, and reveals are logged.** Register
   the field in `SENSITIVE_FIELDS` (`src/platform/sensitive/fields.ts`), send the
   client only `toSensitiveView(...)`, and render it with `SensitiveValue`
   (`src/platform/sensitive/components`). Revealing needs a permission and a reason,
   and it's audited. Audit snapshots mask these fields automatically, provided the
   property name matches.
8. **Files go through the platform attachments module.** It doesn't exist yet. Don't
   store or serve files from a tool. Ask for `src/platform/attachments` to be built
   first.
9. **Fake data only.** Seeds, fixtures and mocks use made-up people, accounts and
   IDs. Never paste real customer data anywhere in the repo.

## Building a tool

### 1. Write the tool's rules first
Before writing code, list the tool's rules in the PR description: who can view,
who can request, who decides, what needs approval, which fields are sensitive,
which limits come from config, and which outside systems it calls. Each rule
becomes a test (step 8).

### 2. Where the code goes
```
src/app/(app)/<tool>/page.tsx        # route: server component, calls requirePermission
src/tools/<tool>/actions.ts          # "use server" actions
src/tools/<tool>/service.ts          # business logic + transactions + recordAudit
src/tools/<tool>/approval-type.ts    # defineApprovalType(...) if the tool needs approvals
src/tools/<tool>/components/         # tool-only UI built from src/platform/ui
prisma/schema.prisma                 # tool models; `npx prisma migrate dev --name <tool>_...`
```
Tools may import from `src/platform`. The platform must never import from a tool.

### 3. Permissions
Add permissions to `PERMISSIONS` and grant them in `ROLE_PERMISSIONS`
(`src/platform/permissions/policy.ts`), which is the only role map. Use `<tool>.<verb>`
names. Give each one a plain-English label in `src/platform/audit/labels.ts`
(`labels.test.ts` fails if one is missing). Any action a tool logs also needs a label
there.

### 4. Server actions
Follow `src/platform/approvals/actions.ts`: validate `FormData`, call
`requirePermission(permission, entity)`, call the service, `revalidatePath`, and
return an `ActionResult` (`{ ok, message }`) with a generic user-facing message.
Raw errors go to the audit log only.

### 5. Approvals
Define the type the way `test/approvals.ts` does: `parse` (validate untrusted input),
`describe`, `entity`, and `execute`, which calls integrations with the
`idempotencyKey`. Also define `checkOutcome` to look up the result after a timeout.
Register it in `approvalRegistry` (`src/platform/approvals/registry.ts`). Requests are
created with `createApprovalRequest`, and decisions appear on `/approvals`
automatically.

### 6. Sidebar and home page
Add or update the entry in `TOOLS` (`src/platform/tools.ts`) with `kind: "tool"`, an
`href`, and its view `permission`. Pick an icon in `src/platform/ui/tool-icons.ts`.
The sidebar Tools section and the home page read from this list. It only controls
what's shown; the page still calls `requirePermission`.

### 7. Shared UI (`src/platform/ui`)
- Page: `PageBody` + `PageHeader`
- Lists: `DataTable`, `FilterBar` (URL-driven), `Pagination`, `LinkTabs`
- Status: `StatusBadge` (tones, not ad-hoc colours; the accent is `primary`)
- Forms: `TextField`, `TextareaField`, `SelectField`, `CheckboxInput`
- Actions that need a reason: `ReasonDialog`, which posts to a server action and toasts the result
- Feedback: `toast` for anything not covered by `ReasonDialog`
- Times: `LocalTime`, never raw ISO strings
- History: `RecordHistory` for a record's audit trail (already filtered by viewer)

Add missing primitives with `npx shadcn@latest add <component>` into
`src/components/ui`. Wrap them in `src/platform/ui` if tools will share them.

### 8. A test for every rule
Every rule from step 1 gets a test. DB-backed tests are named `*.db.test.ts` and use
`setupTestDatabase()` and `seedUser(role)` from `test/db.ts`. Patterns to copy:
- Blocked and logged, for each role without the permission: `src/platform/permissions/denials.db.test.ts`
- Approvals: self-approval blocked, failure returns to pending, timeout handling: `src/platform/approvals/service.db.test.ts`
- Masking and audited reveals: `src/platform/sensitive/service.db.test.ts`
- Change and audit entry in one transaction: `src/platform/audit/record.db.test.ts`
- Config defaults and limits: `src/platform/config.test.ts`

Before opening a PR, run `npm run lint && npm run typecheck && npm test && npm run build`.

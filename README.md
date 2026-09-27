# Internal Tools Platform

## What this is

A prototype built to answer one question for a fintech operations team: can we build our own
internal tools, instead of building them in Power Apps?

It is an ops console with a shared platform underneath (sign-in, role permissions, audit log,
second-person approvals, masked sensitive fields, file attachments and integrations). Each tool
is a thin layer on top that wires those pieces together, so the controls a regulated team needs
are built once and every tool gets them.

Stack: Next.js (App Router, TypeScript) + Tailwind CSS + shadcn/ui, Prisma with PostgreSQL, Vitest.

## Tools

The home page and sidebar list every tool from `TOOLS` in `src/platform/tools.ts`, filtered by the
signed-in user's role.

| Tool       | Route          | Status      | What it does                                                                                              |
| ---------- | -------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| Approvals  | `/approvals`   | Working     | Review requests that need a second person to sign off. Shared by every tool.                              |
| Audit log  | `/admin/audit` | Working     | See who did what, when and why across every tool. Admins and compliance leads only (`audit.view`).        |
| Refunds    | —              | Coming soon | Look up payments and request refunds. Permissions and roles are defined; the page isn't built yet.        |
| KYC review | —              | Coming soon | Review identity checks and record compliance decisions. Permissions and roles are defined; not built yet. |

Seeded users (one per role, picked on the sign-in page):

| User           | Role                  | Can                                                          |
| -------------- | --------------------- | ------------------------------------------------------------ |
| Sam Support    | `SUPPORT`             | View and request refunds, view KYC cases                     |
| Fiona Finance  | `FINANCE_APPROVER`    | View and approve refunds, reveal account numbers             |
| Riley Reviewer | `COMPLIANCE_REVIEWER` | View and review KYC cases, reveal ID numbers                 |
| Lee Lead       | `COMPLIANCE_LEAD`     | Review and decide KYC cases, view the audit log, reveal both |
| Ada Admin      | `ADMIN`               | View the audit log                                           |

The full role map is `ROLE_PERMISSIONS` in `src/platform/permissions/policy.ts`.

## What's mocked and what's real

**Mocked** (safe to demo, swap before any real use):

- **Sign-in.** A "sign in as" picker over the seeded users, backed by a signed session cookie.
  Replace with SSO in `src/platform/auth`.
- **Payments provider.** `src/platform/integrations/payments/mock.ts` stands in for the payments
  API, backed by a `mock_payments` table. Payment ids `pay_mock_decline` and `pay_mock_hang` make it
  fail or hang, to exercise error and timeout paths.
- **File storage.** Attachments are written to local disk (`ATTACHMENTS_STORAGE_DIR`). Swap for
  object storage in `src/platform/integrations/storage`.
- **Data.** All users, accounts and IDs are made up. Never add real customer data.

**Real**: server-side permission checks, the append-only audit log, second-person approvals,
masked sensitive fields and write-once attachments are all enforced by the platform and covered by
tests. See [docs/building-tools.md](docs/building-tools.md).

## Running it

You need:

- Node.js 24 (see `.nvmrc`) — npm 11+ is required
- Docker (for the local Postgres database)

Then:

```bash
cp .env.example .env
docker compose up -d && npm install && npm run db:setup && npm run dev
```

The app runs at http://localhost:3000. Sign in with the "sign in as" picker; `db:setup` seeds one user per role.

## More docs

- [docs/building-tools.md](docs/building-tools.md): adding a tool, permissions and audit, approvals, sensitive fields, attachments
- [docs/development.md](docs/development.md): scripts, project layout, tests, CI

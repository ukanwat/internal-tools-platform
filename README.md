# Internal Tools Platform

A prototype built with Devin to answer one question: could a fintech team build its internal tools in code instead of Power Apps?

It's one Next.js app with a shared platform underneath. The platform handles sign-in, permissions, the audit log, approvals, masking of sensitive fields and file attachments. Three tools sit on top: refunds, KYC review and feature flags. Each tool is mostly its own business rules, so the controls are built once and every tool gets them.

## Run it

You need Node.js 24 (`nvm use`), npm 11+ and Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000 and pick a user on the sign-in page.

## Try it

1. As **Sam Support**, open Refunds and refund $600 on `ORD-1007`. It's over $500, so it goes to finance for approval.
2. As **Fiona Finance**, approve it in Approvals with a reason. It's paid through the mock payments provider.
3. As Sam, refund `ORD-1009`. The mock provider declines it and the refund is marked failed.
4. As **Riley Reviewer**, open a KYC case and reveal the ID number. You have to give a reason.
5. As **Eli Engineer**, request a production flag change. Approve it as **Mia Manager**.
6. As **Lee Lead** or **Ada Admin**, open the audit log to see everything above.

## Tools

| Tool | Route | What it does |
| --- | --- | --- |
| Refunds | `/refunds` | Find an order and refund it. Over $500 needs finance approval. Declined payments are marked failed. |
| KYC review | `/kyc` | Review identity cases. ID numbers stay masked until a reviewer reveals one with a reason. Higher-risk cases need the compliance lead. |
| Feature flags | `/flags` | Change flags in staging. Turning a flag on in production, or raising its rollout, needs a manager. Turning it off is instant. |
| Approvals | `/approvals` | One queue for everything that needs a second person. |
| Audit log | `/admin/audit` | Who did what, when and why, across every tool. |

## Users

| User | Role | Can |
| --- | --- | --- |
| Sam Support | Support | View and request refunds |
| Fiona Finance | Finance approver | Approve refunds, reveal account numbers |
| Riley Reviewer | Compliance reviewer | Review KYC cases, reveal ID numbers |
| Lee Lead | Compliance lead | Decide KYC cases, view the audit log |
| Eli Engineer | Engineer | Change staging flags, turn production flags off, request production changes |
| Mia Manager, Max Manager | Engineering manager | Everything an engineer can, plus approve production changes |
| Ada Admin | Admin | View the audit log |

Nobody can approve their own request. The full role map is in `src/platform/permissions/policy.ts`.

## What's real and what's mocked

Real, and covered by tests:

- Permission checks on the server for every action and page. Denied attempts are logged.
- An audit log that can't be edited. A Postgres trigger blocks updates and deletes, and each change is saved in the same transaction as its audit entry.
- Approvals by a second person, with timeouts handled. If a payment times out, the request is held until the provider confirms what happened.
- Sensitive fields masked on the server. Revealing one needs a permission and a reason, and is logged.
- Attachments that can't be changed or deleted, with every download logged.

Mocked:

- Sign-in is a "sign in as" picker. Real SSO would replace `src/platform/auth`.
- The payments provider and the KYC vendor are mocks in `src/platform/integrations`. KYC ID numbers come from the vendor and aren't stored in the app.
- Files are stored on local disk.
- All data is made up.

## Where to look

- `src/platform`: the shared layer. `src/tools`: the three tools.
- `src/platform/permissions/server-actions.test.ts`: fails if a server action skips the permission check.
- `prisma/migrations/20260927044428_platform_auth_audit/migration.sql`: the audit log trigger.
- `.agents/skills/add-internal-tool/SKILL.md`: the guide Devin followed to build each tool. Start here if you want to add one.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the tests (needs Postgres running) |
| `npm run lint` / `npm run typecheck` | Lint and type check |
| `npm run build` | Production build |
| `npm run db:setup` | Apply migrations and seed the users and data |

CI runs lint, typecheck, tests and build on every pull request.

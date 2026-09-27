# Development

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

## Tests

Unit tests run in jsdom. `*.db.test.ts` files run against a separate `<db>_test` database, which
is created and migrated automatically, so `docker compose up -d` must be running.

## CI

GitHub Actions runs lint, typecheck, tests (against a Postgres service) and build on every pull request.

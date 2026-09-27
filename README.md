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

The app runs at http://localhost:3000.

## Scripts

| Script                | Description                                         |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                        |
| `npm run build`       | Production build                                    |
| `npm run start`       | Serve the production build                          |
| `npm run lint`        | ESLint                                              |
| `npm run typecheck`   | TypeScript type check                               |
| `npm test`            | Run tests once (Vitest)                             |
| `npm run test:watch`  | Run tests in watch mode                             |
| `npm run format`      | Format with Prettier                                |
| `npm run db:setup`    | Apply pending migrations and generate Prisma Client |
| `npm run db:migrate`  | Create/apply a migration after editing the schema   |
| `npm run db:generate` | Regenerate Prisma Client                            |
| `npm run db:studio`   | Open Prisma Studio                                  |

## Project layout

- `src/app` — Next.js routes
- `src/components/ui` — shadcn/ui components (add more with `npx shadcn@latest add <component>`)
- `src/lib/db.ts` — shared Prisma Client instance
- `prisma/schema.prisma` — database schema; `prisma.config.ts` — Prisma CLI config
- `src/generated/prisma` — generated Prisma Client (git-ignored, created on `npm install`)

## CI

GitHub Actions runs lint, typecheck, tests and build on every pull request.

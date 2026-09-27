import "dotenv/config";

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const databaseUrl = new URL(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/internal_tools?schema=public",
);
databaseUrl.pathname = `${databaseUrl.pathname}_test`;
process.env.TEST_DATABASE_URL = databaseUrl.toString();

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["./test/db-global-setup.ts"],
          fileParallelism: false,
          env: {
            DATABASE_URL: databaseUrl.toString(),
            SESSION_SECRET: "test-session-secret-0123456789abcdef",
          },
        },
      },
    ],
  },
});

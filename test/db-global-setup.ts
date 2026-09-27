import { execSync } from "node:child_process";

/** Creates (if needed) and migrates the test database before the DB tests run. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}

import { afterAll, beforeEach } from "vitest";

import { SEED_USERS } from "@/platform/auth/seed-users";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";

/** Truncates platform tables and re-seeds users before each test. */
export function setupTestDatabase() {
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      `TRUNCATE "audit_log", "approval_requests", "mock_payments", "users" CASCADE`,
    );
    await db.user.createMany({ data: [...SEED_USERS] });
  });
  afterAll(async () => {
    await db.$disconnect();
  });
}

export function seedUser(role: CurrentUser["role"]): CurrentUser {
  const user = SEED_USERS.find((u) => u.role === role);
  if (!user) throw new Error(`No seed user for ${role}`);
  return user;
}

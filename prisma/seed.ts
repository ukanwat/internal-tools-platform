import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { FlagEnvironment } from "../src/generated/prisma/enums";
import { SEED_USERS } from "../src/platform/auth/seed-users";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Made-up flags. Existing flag states are left alone on re-seed. */
const SEED_FLAGS = [
  {
    key: "checkout-v2",
    description: "New checkout flow with saved payment methods.",
    states: {
      STAGING: { enabled: true, rolloutPercent: 100 },
      PRODUCTION: { enabled: true, rolloutPercent: 10 },
    },
  },
  {
    key: "search-autocomplete",
    description: "Suggest results while typing in the search box.",
    states: {
      STAGING: { enabled: true, rolloutPercent: 50 },
      PRODUCTION: { enabled: false, rolloutPercent: 0 },
    },
  },
  {
    key: "dark-mode",
    description: "Dark colour scheme for the customer dashboard.",
    states: {
      STAGING: { enabled: false, rolloutPercent: 0 },
      PRODUCTION: { enabled: false, rolloutPercent: 0 },
    },
  },
] satisfies {
  key: string;
  description: string;
  states: Record<FlagEnvironment, { enabled: boolean; rolloutPercent: number }>;
}[];

async function main() {
  for (const user of SEED_USERS) {
    await db.user.upsert({
      where: { id: user.id },
      update: { email: user.email, name: user.name, role: user.role },
      create: user,
    });
  }
  console.log(`Seeded ${SEED_USERS.length} users`);

  for (const flag of SEED_FLAGS) {
    const { id } = await db.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: { key: flag.key, description: flag.description },
    });
    for (const [environment, setting] of Object.entries(flag.states)) {
      await db.featureFlagState.upsert({
        where: {
          flagId_environment: {
            flagId: id,
            environment: environment as FlagEnvironment,
          },
        },
        update: {},
        create: {
          flagId: id,
          environment: environment as FlagEnvironment,
          ...setting,
        },
      });
    }
  }
  console.log(`Seeded ${SEED_FLAGS.length} feature flags`);
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

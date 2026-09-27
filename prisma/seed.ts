import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_USERS } from "../src/platform/auth/seed-users";
import { SEED_KYC_CASES } from "../src/tools/kyc/seed-cases";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  for (const user of SEED_USERS) {
    await db.user.upsert({
      where: { id: user.id },
      update: { email: user.email, name: user.name, role: user.role },
      create: user,
    });
  }
  console.log(`Seeded ${SEED_USERS.length} users`);

  for (const kycCase of SEED_KYC_CASES) {
    const { id, ...details } = kycCase;
    await db.kycCase.upsert({
      where: { id },
      update: details,
      create: kycCase,
    });
  }
  console.log(`Seeded ${SEED_KYC_CASES.length} KYC cases`);
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

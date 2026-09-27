import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_USERS } from "../src/platform/auth/seed-users";

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
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

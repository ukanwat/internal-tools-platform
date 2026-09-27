import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export { db } from "./client";

/** The root client or a transaction client from `db.$transaction`. */
export type DbClient = typeof import("./client").db | Prisma.TransactionClient;

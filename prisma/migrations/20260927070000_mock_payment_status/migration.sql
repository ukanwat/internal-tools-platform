-- CreateEnum
CREATE TYPE "MockPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable: rows written before this migration were successful refunds.
ALTER TABLE "mock_payments" ADD COLUMN "status" "MockPaymentStatus" NOT NULL DEFAULT 'SUCCEEDED';
ALTER TABLE "mock_payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';

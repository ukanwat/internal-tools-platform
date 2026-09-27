-- CreateEnum
CREATE TYPE "KycRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "KycCaseStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "kyc_cases" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "risk_level" "KycRiskLevel" NOT NULL,
    "status" "KycCaseStatus" NOT NULL DEFAULT 'OPEN',
    "vendor_check_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "decided_by_id" TEXT,
    "decision_reason" TEXT,
    "decided_at" TIMESTAMP(3),
    "approval_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_cases_vendor_check_id_key" ON "kyc_cases"("vendor_check_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_cases_approval_request_id_key" ON "kyc_cases"("approval_request_id");

-- CreateIndex
CREATE INDEX "kyc_cases_status_risk_level_created_at_idx" ON "kyc_cases"("status", "risk_level", "created_at");

-- AddForeignKey
ALTER TABLE "kyc_cases" ADD CONSTRAINT "kyc_cases_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_cases" ADD CONSTRAINT "kyc_cases_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

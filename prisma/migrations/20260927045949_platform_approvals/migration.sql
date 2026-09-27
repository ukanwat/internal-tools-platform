-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditOutcome" ADD VALUE 'FAILURE';

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "request_reason" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decision_reason" TEXT,
    "decided_at" TIMESTAMP(3),
    "processing_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_payments" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_status_type_idx" ON "approval_requests"("status", "type");

-- CreateIndex
CREATE INDEX "approval_requests_requested_by_id_created_at_idx" ON "approval_requests"("requested_by_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_requests_status_processing_started_at_idx" ON "approval_requests"("status", "processing_started_at");

-- CreateIndex
CREATE UNIQUE INDEX "mock_payments_idempotency_key_key" ON "mock_payments"("idempotency_key");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

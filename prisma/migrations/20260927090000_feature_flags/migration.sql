-- CreateEnum
CREATE TYPE "FlagEnvironment" AS ENUM ('STAGING', 'PRODUCTION');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ENGINEER';
ALTER TYPE "Role" ADD VALUE 'ENG_MANAGER';

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_states" (
    "id" TEXT NOT NULL,
    "flag_id" TEXT NOT NULL,
    "environment" "FlagEnvironment" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percent" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flag_states_rollout_percent_check" CHECK ("rollout_percent" BETWEEN 0 AND 100)
);

-- CreateTable
CREATE TABLE "feature_flag_approvals" (
    "approval_request_id" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_approvals_pkey" PRIMARY KEY ("approval_request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_states_flag_id_environment_key" ON "feature_flag_states"("flag_id", "environment");

-- AddForeignKey
ALTER TABLE "feature_flag_states" ADD CONSTRAINT "feature_flag_states_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_states" ADD CONSTRAINT "feature_flag_states_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_approvals" ADD CONSTRAINT "feature_flag_approvals_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "feature_flag_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

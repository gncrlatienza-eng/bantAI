-- Account-first lifecycle and application history
-- (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.2, §A.10 phase 2).
-- Non-destructive: no rows or columns are removed. Dropping the two unique
-- indexes lets one user / one workspace hold many historical requests.
-- One open request per user is enforced in AccessRequestsService inside a
-- Serializable transaction (Prisma 5 cannot model a partial unique index
-- without schema drift).

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('ACCOUNT_CREATED', 'ACCOUNT_SETUP_COMPLETED', 'APPLICATION_SUBMITTED', 'APPLICATION_WITHDRAWN', 'APPLICATION_APPROVED', 'APPLICATION_DECLINED', 'LICENSE_ACTIVATED', 'LICENSE_EXPIRED', 'LICENSE_SUSPENDED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'API_KEY_ROTATED', 'ADMIN_ROLE_CHANGED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessRequestStatus" ADD VALUE 'WITHDRAWN';
ALTER TYPE "AccessRequestStatus" ADD VALUE 'SUPERSEDED';

-- DropIndex
DROP INDEX "AccessRequest_portalOrganizationId_key";

-- DropIndex
DROP INDEX "AccessRequest_portalUserId_key";

-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN     "previousAccessRequestId" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "organizationId" TEXT,
    "accessRequestId" TEXT,
    "licenseId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_type_createdAt_idx" ON "AuditEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetUserId_createdAt_idx" ON "AuditEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_accessRequestId_idx" ON "AuditEvent"("accessRequestId");

-- CreateIndex
CREATE INDEX "AccessRequest_portalUserId_createdAt_idx" ON "AccessRequest"("portalUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_portalOrganizationId_idx" ON "AccessRequest"("portalOrganizationId");

-- CreateIndex
CREATE INDEX "AccessRequest_previousAccessRequestId_idx" ON "AccessRequest"("previousAccessRequestId");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_previousAccessRequestId_fkey" FOREIGN KEY ("previousAccessRequestId") REFERENCES "AccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: existing web portal identities proved control of their email when
-- they were provisioned (paid-checkout claim OTP) and admins are provisioned
-- internally, so both count as verified and set up. Mobile-only users stay
-- NOT_STARTED; without a portal password they cannot sign in on the web.
UPDATE "User"
SET "onboardingStatus" = 'COMPLETE',
    "onboardingCompletedAt" = "createdAt",
    "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "passwordHash" IS NOT NULL OR "role" = 'ADMIN';

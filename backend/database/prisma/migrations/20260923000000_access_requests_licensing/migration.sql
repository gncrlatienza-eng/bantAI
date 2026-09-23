-- Licensing / access requests
--
-- Adds the AccessRequest + AccessRequestToken tables and their supporting
-- enums. See `web/src/pages/RequestAccess` for the frontend that produces
-- these rows and `src/access-requests` + `src/payments` for the backend
-- that services them.

-- CreateEnum
CREATE TYPE "AccessRequestTier" AS ENUM ('RESEARCH', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM (
  'RECEIVED',
  'UNDER_REVIEW',
  'APPROVED',
  'DECLINED',
  'PAYMENT_PENDING',
  'ACTIVE',
  'CANCELLED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "tier" "AccessRequestTier" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "intendedUse" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declinedReason" TEXT,
    "billingPeriod" "BillingPeriod",
    "stripeCustomerId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequestToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_stripeCheckoutSessionId_key"
  ON "AccessRequest"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_stripeSubscriptionId_key"
  ON "AccessRequest"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_createdAt_idx"
  ON "AccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx"
  ON "AccessRequest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequestToken_tokenHash_key"
  ON "AccessRequestToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessRequestToken_accessRequestId_usedAt_idx"
  ON "AccessRequestToken"("accessRequestId", "usedAt");

-- AddForeignKey
ALTER TABLE "AccessRequestToken"
  ADD CONSTRAINT "AccessRequestToken_accessRequestId_fkey"
  FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

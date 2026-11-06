ALTER TABLE "AccessRequest" ADD COLUMN "portalOrganizationId" TEXT;

ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'OWNER';

CREATE TYPE "EmailOtpPurpose" AS ENUM (
  'CLIENT_SIGN_IN',
  'CLIENT_CLAIM',
  'ADMIN_SIGN_IN'
);

CREATE TYPE "LicenseStatus" AS ENUM (
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED'
);

CREATE UNIQUE INDEX "AccessRequest_portalOrganizationId_key"
  ON "AccessRequest"("portalOrganizationId");

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_portalOrganizationId_fkey"
  FOREIGN KEY ("portalOrganizationId") REFERENCES "PortalOrganization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailOtpChallenge" (
  "id" TEXT NOT NULL,
  "challengeKey" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "accessRequestId" TEXT,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "requestWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailOtpChallenge_challengeKey_key"
  ON "EmailOtpChallenge"("challengeKey");

CREATE INDEX "EmailOtpChallenge_email_purpose_accessRequestId_idx"
  ON "EmailOtpChallenge"("email", "purpose", "accessRequestId");

CREATE INDEX "EmailOtpChallenge_expiresAt_consumedAt_idx"
  ON "EmailOtpChallenge"("expiresAt", "consumedAt");

ALTER TABLE "EmailOtpChallenge"
  ADD CONSTRAINT "EmailOtpChallenge_accessRequestId_fkey"
  FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "License" (
  "id" TEXT NOT NULL,
  "accessRequestId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tier" "AccessRequestTier" NOT NULL,
  "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingPeriod" "BillingPeriod" NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "lastStripeEventCreated" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "License_accessRequestId_key"
  ON "License"("accessRequestId");

CREATE UNIQUE INDEX "License_stripeSubscriptionId_key"
  ON "License"("stripeSubscriptionId");

CREATE INDEX "License_organizationId_status_validUntil_idx"
  ON "License"("organizationId", "status", "validUntil");

ALTER TABLE "License"
  ADD CONSTRAINT "License_accessRequestId_fkey"
  FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "License"
  ADD CONSTRAINT "License_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PortalOrganization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

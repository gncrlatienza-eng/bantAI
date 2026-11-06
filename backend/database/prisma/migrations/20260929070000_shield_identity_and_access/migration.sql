BEGIN;

-- Add a portal-specific role. Mobile-only identities intentionally remain NULL.
CREATE TYPE "WebRole" AS ENUM ('SHIELD', 'ADMIN');
ALTER TABLE "User" ADD COLUMN "webRole" "WebRole";

UPDATE "User"
SET "webRole" = 'ADMIN'::"WebRole"
WHERE "role" = 'ADMIN';

UPDATE "User" AS u
SET "webRole" = 'SHIELD'::"WebRole"
WHERE u."role" = 'USER'
  AND u."emailVerifiedAt" IS NOT NULL
  AND u."onboardingStatus" = 'COMPLETE'
  AND (
    EXISTS (
      SELECT 1
      FROM "OrganizationMembership" AS membership
      WHERE membership."userId" = u."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "AccessRequest" AS request
      WHERE request."portalUserId" = u."id"
    )
  );

-- Every active licensed workspace member must have an explicit Shield role.
-- Abort rather than deploy a partially migrated authorization boundary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "OrganizationMembership" AS membership
    JOIN "User" AS u ON u."id" = membership."userId"
    JOIN "License" AS license ON license."organizationId" = membership."organizationId"
    WHERE license."status" = 'ACTIVE'
      AND license."validFrom" <= CURRENT_TIMESTAMP
      AND (license."validUntil" IS NULL OR license."validUntil" > CURRENT_TIMESTAMP)
      AND u."webRole" IS NULL
  ) THEN
    RAISE EXCEPTION 'Shield migration found an active licensed member without a portal role';
  END IF;
END $$;

-- Preserve original products before the enum is collapsed. All pre-existing
-- licenses remain unapproved for Shield regardless of their billing status.
-- Historical requests cannot mint an approved Shield license via a later
-- checkout webhook. A separate contract decision is required for each one.
ALTER TABLE "AccessRequest" ADD COLUMN "legacyTier" TEXT;
ALTER TABLE "AccessRequestDeletionAudit" ADD COLUMN "legacyTier" TEXT;
CREATE TYPE "ShieldReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "License"
  ADD COLUMN "legacyTier" TEXT,
  ADD COLUMN "shieldApprovedAt" TIMESTAMP(3),
  ADD COLUMN "shieldReviewDecision" "ShieldReviewDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "shieldReviewedAt" TIMESTAMP(3),
  ADD COLUMN "shieldReviewedByUserId" TEXT,
  ADD COLUMN "shieldReviewReason" TEXT;
UPDATE "AccessRequest" SET "legacyTier" = "tier"::text;
UPDATE "AccessRequestDeletionAudit" SET "legacyTier" = "tier"::text;
UPDATE "License" SET "legacyTier" = "tier"::text;
ALTER TABLE "License" ADD CONSTRAINT "License_shield_review_consistent"
  CHECK (("shieldReviewDecision" = 'APPROVED') = ("shieldApprovedAt" IS NOT NULL));

-- Collapse legacy Research/Organization products into the one Shield plan.
ALTER TYPE "AccessRequestTier" RENAME TO "AccessRequestTier_old";
CREATE TYPE "AccessRequestTier" AS ENUM ('SHIELD');
ALTER TABLE "AccessRequest" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "AccessRequest" ALTER COLUMN "tier" TYPE "AccessRequestTier"
  USING ('SHIELD'::"AccessRequestTier");
ALTER TABLE "AccessRequest" ALTER COLUMN "tier" SET DEFAULT 'SHIELD';
ALTER TABLE "AccessRequestDeletionAudit" ALTER COLUMN "tier" TYPE "AccessRequestTier"
  USING ('SHIELD'::"AccessRequestTier");
ALTER TABLE "License" ALTER COLUMN "tier" TYPE "AccessRequestTier"
  USING ('SHIELD'::"AccessRequestTier");
ALTER TABLE "License" ALTER COLUMN "tier" SET DEFAULT 'SHIELD';
DROP TYPE "AccessRequestTier_old";

-- Membership now binds a Shield account to a tenant; it no longer grants tiers.
DROP INDEX IF EXISTS "OrganizationMembership_userId_role_idx";
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" SET DEFAULT 'SHIELD';
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- Explicit campaign publication metadata. NULL publishedAt is always private.
ALTER TABLE "CampaignCluster"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "risk" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN "mitigation" TEXT;

CREATE TABLE "ShieldCampaignMessage" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "maskedText" TEXT NOT NULL,
  "language" TEXT,
  "classification" TEXT,
  "confidence" DOUBLE PRECISION,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShieldCampaignMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShieldCampaignMessage_campaignId_approvedAt_idx"
  ON "ShieldCampaignMessage"("campaignId", "approvedAt");
ALTER TABLE "ShieldCampaignMessage"
  ADD CONSTRAINT "ShieldCampaignMessage_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "CampaignCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShieldCampaignMessage"
  ADD CONSTRAINT "ShieldCampaignMessage_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "ShieldApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "ShieldApiScope" AS ENUM (
  'READ_CAMPAIGNS',
  'READ_INDICATORS',
  'READ_MASKED_MESSAGES',
  'EXPORT_CAMPAIGNS'
);
CREATE TABLE "ShieldApiKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keySuffix" TEXT NOT NULL,
  "scopes" "ShieldApiScope"[] NOT NULL,
  "status" "ShieldApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShieldApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShieldApiKey_secretHash_key" ON "ShieldApiKey"("secretHash");
CREATE INDEX "ShieldApiKey_organizationId_status_idx" ON "ShieldApiKey"("organizationId", "status");
CREATE INDEX "ShieldApiKey_createdByUserId_idx" ON "ShieldApiKey"("createdByUserId");
ALTER TABLE "ShieldApiKey"
  ADD CONSTRAINT "ShieldApiKey_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PortalOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShieldApiKey"
  ADD CONSTRAINT "ShieldApiKey_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_DEACTIVATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_PUBLISHED';
ALTER TYPE "AuditEventType" ADD VALUE 'RESTRICTED_MESSAGE_ACCESSED';
ALTER TYPE "AuditEventType" ADD VALUE 'LICENSE_SHIELD_REVIEWED';

COMMIT;

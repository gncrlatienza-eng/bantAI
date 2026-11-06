-- Security/privacy remediation: roles, OTP race controls, data minimisation,
-- idempotent SMS ingest, attribution, and query indexes.
-- The purge and identity conversion must be atomic: either all sensitive legacy
-- rows are removed and identities canonicalized, or none of the changes apply.
BEGIN;

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Legacy rows used 09..., 639..., and +639... interchangeably.  Purge the
-- old raw telemetry first (as disclosed below), then deterministically retain
-- one profile per canonical mobile number before restoring the unique key.
TRUNCATE TABLE "SmsMessage" CASCADE;
TRUNCATE TABLE "Contact", "BlockedNumber", "SenderVerificationCache";
UPDATE "CampaignCluster" SET "messageCount" = 0;
ALTER TABLE "User" ADD COLUMN "normalizedPhone" TEXT;
UPDATE "User"
SET "normalizedPhone" = CASE
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^00639[0-9]{9}$'
    THEN '+' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 3)
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
    THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
    THEN '+63' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
  ELSE NULL
END;
DELETE FROM "User" duplicate
USING "User" survivor
WHERE duplicate."normalizedPhone" IS NOT NULL
  AND duplicate."normalizedPhone" = survivor."normalizedPhone"
  AND (survivor."createdAt", survivor."id") < (duplicate."createdAt", duplicate."id");
UPDATE "User" SET "phone" = "normalizedPhone" WHERE "normalizedPhone" IS NOT NULL;
ALTER TABLE "User" DROP COLUMN "normalizedPhone";

-- OTP records are a single mutable challenge per phone. This prevents several
-- concurrent requests leaving multiple usable codes.
-- Existing plaintext codes are intentionally invalidated and removed.
TRUNCATE TABLE "OtpCode";
ALTER TABLE "OtpCode" ADD COLUMN "codeHash" TEXT;
ALTER TABLE "OtpCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OtpCode" ADD COLUMN "requestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OtpCode" ADD COLUMN "requestWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "OtpCode" ALTER COLUMN "codeHash" SET NOT NULL;
ALTER TABLE "OtpCode" DROP COLUMN "code";
CREATE UNIQUE INDEX "OtpCode_phone_key" ON "OtpCode"("phone");
DROP INDEX IF EXISTS "OtpCode_phone_verified_idx";
CREATE INDEX "OtpCode_phone_verified_createdAt_idx" ON "OtpCode"("phone", "verified", "createdAt");

ALTER TABLE "SmsMessage" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "SmsMessage" ADD COLUMN "trusted" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "SmsMessage_userId_sourceId_key" ON "SmsMessage"("userId", "sourceId");
CREATE INDEX "SmsMessage_clusterId_receivedAt_idx" ON "SmsMessage"("clusterId", "receivedAt");
CREATE INDEX "CampaignCluster_urlDomains_gin_idx" ON "CampaignCluster" USING GIN ("urlDomains");

CREATE TABLE "SenderReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "reportWindow" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "validatedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SenderReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SenderReport_userId_sender_reportWindow_key" ON "SenderReport"("userId", "sender", "reportWindow");
CREATE INDEX "SenderReport_sender_status_createdAt_idx" ON "SenderReport"("sender", "status", "createdAt");
ALTER TABLE "SenderReport" ADD CONSTRAINT "SenderReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SenderReport" ADD CONSTRAINT "SenderReport_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

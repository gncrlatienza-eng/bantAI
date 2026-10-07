CREATE TYPE "CloudVerificationStatus" AS ENUM (
  'pending',
  'processing',
  'verified',
  'retryable_failure',
  'failed'
);

CREATE TABLE "CloudVerificationJob" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "approvedArtifactDigest" TEXT NOT NULL,
  "status" "CloudVerificationStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "publishedAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "retryAfter" TIMESTAMP(3),
  "lastError" TEXT,
  "resultCommittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudVerificationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CloudVerificationAdmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "admissionKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudVerificationAdmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudVerificationJob_messageId_modelVersion_approvedArtifactDigest_key"
  ON "CloudVerificationJob"("messageId", "modelVersion", "approvedArtifactDigest");
CREATE INDEX "CloudVerificationJob_status_availableAt_idx"
  ON "CloudVerificationJob"("status", "availableAt");
CREATE INDEX "CloudVerificationJob_leaseExpiresAt_idx"
  ON "CloudVerificationJob"("leaseExpiresAt");
CREATE UNIQUE INDEX "CloudVerificationAdmission_admissionKey_key"
  ON "CloudVerificationAdmission"("admissionKey");
CREATE INDEX "CloudVerificationAdmission_admittedAt_idx"
  ON "CloudVerificationAdmission"("admittedAt");
CREATE INDEX "CloudVerificationAdmission_userId_admittedAt_idx"
  ON "CloudVerificationAdmission"("userId", "admittedAt");

ALTER TABLE "CloudVerificationJob"
  ADD CONSTRAINT "CloudVerificationJob_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "SmsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloudVerificationAdmission"
  ADD CONSTRAINT "CloudVerificationAdmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

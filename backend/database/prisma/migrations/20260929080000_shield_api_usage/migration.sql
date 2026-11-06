BEGIN;

ALTER TABLE "PortalOrganization"
  ADD COLUMN "apiMonthlyQuota" INTEGER NOT NULL DEFAULT 50000,
  ADD COLUMN "apiRateLimitPerMinute" INTEGER NOT NULL DEFAULT 100;
ALTER TYPE "AuditEventType" ADD VALUE 'API_LIMITS_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE 'MASKED_MESSAGE_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'REPORT_VALIDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'REPORT_REJECTED';

CREATE TABLE "ShieldApiRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShieldApiRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShieldApiRequest_organizationId_createdAt_idx" ON "ShieldApiRequest"("organizationId", "createdAt");
CREATE INDEX "ShieldApiRequest_keyId_createdAt_idx" ON "ShieldApiRequest"("keyId", "createdAt");
ALTER TABLE "ShieldApiRequest" ADD CONSTRAINT "ShieldApiRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PortalOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShieldApiRequest" ADD CONSTRAINT "ShieldApiRequest_keyId_fkey"
  FOREIGN KEY ("keyId") REFERENCES "ShieldApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- Portal account enforcement is deliberately independent from billing state.
CREATE TYPE "PortalAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "PortalEnforcementAction" AS ENUM ('SUSPEND', 'RESTORE', 'REVOKE');
CREATE TYPE "AccessRequestEmailKind" AS ENUM ('SUBMISSION', 'APPROVAL', 'ACTIVATION');
CREATE TYPE "AccessRequestEmailDeliveryStatus" AS ENUM ('ACCEPTED', 'FAILED');

ALTER TABLE "User"
ADD COLUMN "portalAccessStatus" "PortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "portalAccessReason" TEXT,
ADD COLUMN "portalAccessUpdatedAt" TIMESTAMP(3),
ADD COLUMN "portalAccessUpdatedBy" TEXT;

CREATE TABLE "PortalAccessAudit" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "PortalEnforcementAction" NOT NULL,
    "previousStatus" "PortalAccessStatus" NOT NULL,
    "newStatus" "PortalAccessStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessRequestEmailDelivery" (
    "id" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "kind" "AccessRequestEmailKind" NOT NULL,
    "status" "AccessRequestEmailDeliveryStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastAcceptedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequestEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalAccessAudit_targetUserId_createdAt_idx"
ON "PortalAccessAudit"("targetUserId", "createdAt");

CREATE INDEX "PortalAccessAudit_actorUserId_createdAt_idx"
ON "PortalAccessAudit"("actorUserId", "createdAt");

CREATE UNIQUE INDEX "AccessRequestEmailDelivery_accessRequestId_kind_key"
ON "AccessRequestEmailDelivery"("accessRequestId", "kind");

CREATE INDEX "AccessRequestEmailDelivery_kind_status_lastAttemptAt_idx"
ON "AccessRequestEmailDelivery"("kind", "status", "lastAttemptAt");

ALTER TABLE "PortalAccessAudit"
ADD CONSTRAINT "PortalAccessAudit_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortalAccessAudit"
ADD CONSTRAINT "PortalAccessAudit_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessRequestEmailDelivery"
ADD CONSTRAINT "AccessRequestEmailDelivery_accessRequestId_fkey"
FOREIGN KEY ("accessRequestId") REFERENCES "AccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

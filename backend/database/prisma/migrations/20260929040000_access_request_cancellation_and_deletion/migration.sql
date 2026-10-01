-- Record why and by whom an access request was cancelled.
ALTER TABLE "AccessRequest"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledBy" TEXT,
ADD COLUMN "cancelledReason" TEXT;

-- Preserve a privacy-minimized audit trail when a terminal request is deleted.
CREATE TABLE "AccessRequestDeletionAudit" (
    "id" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "referenceNumber" INTEGER NOT NULL,
    "tier" "AccessRequestTier" NOT NULL,
    "terminalStatus" "AccessRequestStatus" NOT NULL,
    "emailHash" TEXT NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequestDeletionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequestDeletionAudit_deletedAt_idx"
ON "AccessRequestDeletionAudit"("deletedAt");

CREATE INDEX "AccessRequestDeletionAudit_deletedBy_deletedAt_idx"
ON "AccessRequestDeletionAudit"("deletedBy", "deletedAt");

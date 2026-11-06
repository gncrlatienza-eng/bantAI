BEGIN;

ALTER TABLE "SmsMessage" ADD COLUMN "campaignMatchSource" TEXT;
ALTER TABLE "ShieldCampaignMessage" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "CampaignCluster"
  ADD COLUMN "countVerified" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
CREATE TYPE "CampaignEvolutionStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "CampaignOperation" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceIds" TEXT[] NOT NULL,
  "targetCampaignId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReferences" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignOperation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignOperation_createdAt_idx" ON "CampaignOperation"("createdAt");

CREATE TABLE "CampaignAssignmentHistory" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "previousCampaignId" TEXT,
  "nextCampaignId" TEXT,
  "previousMatchSource" TEXT,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignAssignmentHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignAssignmentHistory_messageId_createdAt_idx"
  ON "CampaignAssignmentHistory"("messageId", "createdAt");
CREATE INDEX "CampaignAssignmentHistory_operationId_idx"
  ON "CampaignAssignmentHistory"("operationId");
ALTER TABLE "CampaignAssignmentHistory"
  ADD CONSTRAINT "CampaignAssignmentHistory_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "SmsMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignAssignmentHistory"
  ADD CONSTRAINT "CampaignAssignmentHistory_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "CampaignOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CampaignEvolutionEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceReferences" TEXT[] NOT NULL,
  "status" "CampaignEvolutionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignEvolutionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignEvolutionEvent_campaignId_status_createdAt_idx"
  ON "CampaignEvolutionEvent"("campaignId", "status", "createdAt");
ALTER TABLE "CampaignEvolutionEvent"
  ADD CONSTRAINT "CampaignEvolutionEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "CampaignCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_MERGED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_SPLIT';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_ASSIGNMENT_CORRECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_EVOLUTION_APPROVED';

COMMIT;

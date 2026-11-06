-- CreateEnum
CREATE TYPE "DatasetSplit" AS ENUM ('TRAIN', 'HOLDOUT');

-- CreateEnum
CREATE TYPE "ModelCandidateStatus" AS ENUM ('REGISTERED', 'EVALUATING', 'APPROVED', 'REJECTED', 'ACTIVATION_REQUESTED', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "RetrainingJobStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriftInvestigationStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('SHIELD', 'ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'DATASET_SAMPLE_CURATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DATASET_SAMPLE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DATASET_SAMPLE_EXCLUDED';
ALTER TYPE "AuditEventType" ADD VALUE 'MODEL_CANDIDATE_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'MODEL_CANDIDATE_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'MODEL_ACTIVATION_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'RETRAINING_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'MODEL_ACTIVATION_CONFIRMED';
ALTER TYPE "AuditEventType" ADD VALUE 'DATASET_SNAPSHOT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DRIFT_INVESTIGATION_OPENED';
ALTER TYPE "AuditEventType" ADD VALUE 'DRIFT_INVESTIGATION_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CAMPAIGN_ANALYSIS_RUN';

-- AlterTable
ALTER TABLE "CampaignEvolutionEvent" ADD COLUMN     "observationId" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "ModelVersion" ADD COLUMN     "activationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "activationRequestedByUserId" TEXT,
ADD COLUMN     "evaluation" JSONB,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "runtimeActivationConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ModelCandidateStatus" NOT NULL DEFAULT 'REGISTERED';

-- CreateTable
CREATE TABLE "CampaignObservation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "previousMessageCount" INTEGER NOT NULL,
    "domains" TEXT[],
    "newDomains" TEXT[],
    "languageCounts" JSONB NOT NULL,
    "dominantLanguage" TEXT,
    "previousDominantLanguage" TEXT,
    "activityChange" TEXT NOT NULL,
    "evidenceMessageIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetSample" (
    "id" TEXT NOT NULL,
    "sourceReportId" TEXT,
    "maskedText" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "language" TEXT,
    "split" "DatasetSplit" NOT NULL DEFAULT 'TRAIN',
    "included" BOOLEAN NOT NULL DEFAULT true,
    "provenance" TEXT NOT NULL,
    "consentConfirmed" BOOLEAN NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetSampleRevision" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "maskedText" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "language" TEXT,
    "included" BOOLEAN NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetSampleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetSnapshot" (
    "id" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetSnapshotItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sampleVersion" INTEGER NOT NULL,
    "maskedText" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "language" TEXT,
    "provenance" TEXT NOT NULL,

    CONSTRAINT "DatasetSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrainingJob" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "RetrainingJobStatus" NOT NULL DEFAULT 'REQUESTED',
    "datasetVersion" TEXT,
    "requestedByUserId" TEXT,
    "providerJobId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriftInvestigation" (
    "id" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "status" "DriftInvestigationStatus" NOT NULL DEFAULT 'OPEN',
    "modelVersionTag" TEXT,
    "metrics" JSONB NOT NULL,
    "notes" TEXT,
    "resolution" TEXT,
    "retrainingJobId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriftInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "campaignChangesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "apiUsageAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "exportUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "systemHealthAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "sourceKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignObservation_campaignId_windowEnd_idx" ON "CampaignObservation"("campaignId", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignObservation_campaignId_windowStart_windowEnd_algori_key" ON "CampaignObservation"("campaignId", "windowStart", "windowEnd", "algorithmVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetSample_sourceReportId_key" ON "DatasetSample"("sourceReportId");

-- CreateIndex
CREATE INDEX "DatasetSample_split_included_label_idx" ON "DatasetSample"("split", "included", "label");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetSampleRevision_sampleId_version_key" ON "DatasetSampleRevision"("sampleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetSnapshot_versionTag_key" ON "DatasetSnapshot"("versionTag");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetSnapshotItem_snapshotId_sampleId_key" ON "DatasetSnapshotItem"("snapshotId", "sampleId");

-- CreateIndex
CREATE INDEX "RetrainingJob_createdAt_idx" ON "RetrainingJob"("createdAt");

-- CreateIndex
CREATE INDEX "DriftInvestigation_status_createdAt_idx" ON "DriftInvestigation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "PortalNotification_userId_audience_readAt_createdAt_idx" ON "PortalNotification"("userId", "audience", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalNotification_userId_sourceKey_key" ON "PortalNotification"("userId", "sourceKey");

-- AddForeignKey
ALTER TABLE "CampaignObservation" ADD CONSTRAINT "CampaignObservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CampaignCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetSample" ADD CONSTRAINT "DatasetSample_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "UserReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetSampleRevision" ADD CONSTRAINT "DatasetSampleRevision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "DatasetSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetSnapshotItem" ADD CONSTRAINT "DatasetSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DatasetSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetSnapshotItem" ADD CONSTRAINT "DatasetSnapshotItem_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "DatasetSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalNotification" ADD CONSTRAINT "PortalNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "CampaignCluster" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "CampaignCluster_archivedAt_idx" ON "CampaignCluster"("archivedAt");

-- Persist the stable category emitted by the AI campaign sync so clients can
-- group campaigns without parsing the human-readable label.
ALTER TABLE "CampaignCluster" ADD COLUMN "category" TEXT;

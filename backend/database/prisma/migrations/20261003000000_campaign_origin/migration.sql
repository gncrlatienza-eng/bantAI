-- Marks campaigns grouped on the server from unmatched scam texts
-- ("EMERGING"); null for offline-clustering and Admin-drafted campaigns.
ALTER TABLE "CampaignCluster" ADD COLUMN "origin" TEXT;

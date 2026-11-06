-- Versioned campaign wording profile for the AI matcher's hybrid tier
-- (audit 2026-09-30, finding 5). Nullable: campaigns created before it
-- match on the embedding and their reviewed urlDomains only.
ALTER TABLE "CampaignCluster" ADD COLUMN "lexicalProfile" JSONB;

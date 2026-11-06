-- RenameIndex
ALTER INDEX "CampaignCluster_urlDomains_gin_idx" RENAME TO "CampaignCluster_urlDomains_idx";

-- RenameIndex
ALTER INDEX "TrustedOrganization_officialDomains_gin_idx" RENAME TO "TrustedOrganization_officialDomains_idx";

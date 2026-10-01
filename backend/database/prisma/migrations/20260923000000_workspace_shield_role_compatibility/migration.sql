-- This separate migration commits enum values before workspace defaults use
-- them. It also supports upgrading a local Shield-only database without
-- dropping existing membership roles or granting a new one to any account.
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'TIER_1';
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'TIER_2';
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'SHIELD';

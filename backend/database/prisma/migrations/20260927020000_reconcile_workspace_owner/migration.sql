-- Backfill the explicit workspace owner introduced by the W1-W10 workspace UI.
-- The authoritative paid-access relation remains AccessRequest.portalOrganizationId.
UPDATE "PortalOrganization" AS organization
SET "ownerId" = membership."userId"
FROM "OrganizationMembership" AS membership
WHERE membership."organizationId" = organization."id"
  AND membership."role" = 'OWNER'
  AND organization."ownerId" IS NULL;

-- Backfill only explicit paid-account relationships. Do not infer ownership by
-- company name or email. Unclaimed active requests will be provisioned on the
-- next verified Stripe event or controlled reconciliation.
INSERT INTO "PortalOrganization" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT
  CONCAT('legacy-', SUBSTRING(ar."id", 1, 24)),
  CONCAT(ar."organization", ' (', SUBSTRING(ar."id", 1, 8), ')'),
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AccessRequest" ar
WHERE ar."status" = 'ACTIVE'
  AND ar."portalUserId" IS NOT NULL
  AND ar."portalOrganizationId" IS NULL;

UPDATE "AccessRequest" ar
SET "portalOrganizationId" = CONCAT('legacy-', SUBSTRING(ar."id", 1, 24))
WHERE ar."status" = 'ACTIVE'
  AND ar."portalUserId" IS NOT NULL
  AND ar."portalOrganizationId" IS NULL;

INSERT INTO "License" (
  "id", "accessRequestId", "organizationId", "tier", "status",
  "billingPeriod", "stripeCustomerId", "stripeSubscriptionId", "validFrom",
  "validUntil", "createdAt", "updatedAt"
)
SELECT
  CONCAT('license-', SUBSTRING(ar."id", 1, 24)),
  ar."id",
  ar."portalOrganizationId",
  ar."tier",
  'ACTIVE'::"LicenseStatus",
  ar."billingPeriod",
  ar."stripeCustomerId",
  ar."stripeSubscriptionId",
  COALESCE(ar."activatedAt", CURRENT_TIMESTAMP),
  ar."expiresAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AccessRequest" ar
WHERE ar."status" = 'ACTIVE'
  AND ar."portalUserId" IS NOT NULL
  AND ar."portalOrganizationId" IS NOT NULL
  AND ar."billingPeriod" IS NOT NULL
ON CONFLICT ("accessRequestId") DO NOTHING;

INSERT INTO "OrganizationMembership" (
  "id", "organizationId", "userId", "role", "createdAt", "updatedAt"
)
SELECT
  CONCAT('membership-', SUBSTRING(ar."id", 1, 24)),
  ar."portalOrganizationId",
  ar."portalUserId",
  'OWNER'::"OrganizationMemberRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AccessRequest" ar
WHERE ar."status" = 'ACTIVE'
  AND ar."portalUserId" IS NOT NULL
  AND ar."portalOrganizationId" IS NOT NULL
ON CONFLICT ("organizationId", "userId") DO NOTHING;

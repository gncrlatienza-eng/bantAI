-- Organization-scoped dashboard access. This is deliberately distinct from
-- TrustedOrganization, which is sender-evidence data rather than a tenant.
CREATE TYPE "OrganizationMemberRole" AS ENUM ('TIER_1', 'TIER_2');

CREATE TABLE "PortalOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortalOrganization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalOrganization_name_key" ON "PortalOrganization"("name");
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_role_idx" ON "OrganizationMembership"("userId", "role");
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PortalOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Curated organization evidence; never use a community familiarity graph.
CREATE TABLE "TrustedOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "officialDomains" TEXT[] NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrustedOrganization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustedOrganization_sender_key" ON "TrustedOrganization"("sender");
CREATE INDEX "TrustedOrganization_isActive_expiresAt_idx" ON "TrustedOrganization"("isActive", "expiresAt");
CREATE INDEX "TrustedOrganization_officialDomains_gin_idx" ON "TrustedOrganization" USING GIN ("officialDomains");

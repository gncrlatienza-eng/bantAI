-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPERADMIN', 'SUPPORT', 'ANALYST', 'OPERATIONS', 'PRIVACY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffRole" "StaffRole";

-- AlterTable
ALTER TABLE "PortalOrganization" ADD COLUMN "ownerId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'TIER_2',
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_status_idx" ON "OrganizationInvitation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PortalOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessRequestStatus" ADD VALUE 'MORE_INFO_REQUIRED';
ALTER TYPE "AccessRequestStatus" ADD VALUE 'AGREEMENT_ACCEPTED';

-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN     "accuracyConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "agreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "applicantRole" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "expectedUsers" INTEGER,
ADD COLUMN     "infoRequestMessage" TEXT,
ADD COLUMN     "infoRequestedAt" TIMESTAMP(3),
ADD COLUMN     "pilotInterest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productUpdatesOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referenceNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_referenceNumber_key" ON "AccessRequest"("referenceNumber");


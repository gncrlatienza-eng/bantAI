-- AlterTable
ALTER TABLE "OtpCode" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "OtpCode" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_email_key" ON "OtpCode"("email");

-- CreateIndex
CREATE INDEX "OtpCode_email_verified_createdAt_idx" ON "OtpCode"("email", "verified", "createdAt");

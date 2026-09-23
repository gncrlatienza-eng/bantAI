-- The preceding migration removed the legacy OTP table for Firebase Auth.
-- Restore a fresh hardened challenge table for backend-issued Semaphore OTPs.
-- Previously issued codes cannot be recovered and must be requested again.
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "requestWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OtpCode_phone_key" ON "OtpCode"("phone");
CREATE INDEX "OtpCode_phone_verified_createdAt_idx" ON "OtpCode"("phone", "verified", "createdAt");

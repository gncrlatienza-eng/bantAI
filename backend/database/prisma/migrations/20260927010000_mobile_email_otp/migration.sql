-- Temporary mobile Gmail OTP authentication. The verified login address is
-- deliberately separate from User.email, which is an editable profile field.
ALTER TYPE "EmailOtpPurpose" ADD VALUE IF NOT EXISTS 'MOBILE_SIGN_IN';

ALTER TABLE "User" ADD COLUMN "mobileAuthEmail" TEXT;

CREATE UNIQUE INDEX "User_mobileAuthEmail_key"
  ON "User"("mobileAuthEmail");

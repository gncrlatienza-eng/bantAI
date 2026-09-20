-- Firebase Authentication now owns mobile phone verification. OTP rows are
-- short-lived challenges and are no longer read by the application.
DROP TABLE IF EXISTS "OtpCode";

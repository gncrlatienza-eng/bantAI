-- What the reviewer says a rejected report's text really is (Ham | Spam),
-- so the phone can move it out of the scam path. Null while pending, on
-- accepted reports, and on rejections made without a label.
ALTER TABLE "UserReport" ADD COLUMN "reviewedLabel" TEXT;

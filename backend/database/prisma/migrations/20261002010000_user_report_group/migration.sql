-- Messages reported together from the phone share a groupId (null for a
-- single-message report).
ALTER TABLE "UserReport" ADD COLUMN "groupId" TEXT;

CREATE INDEX "UserReport_groupId_idx" ON "UserReport"("groupId");

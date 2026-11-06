-- Bind each paid access request to at most one portal user. Account creation
-- claims this relationship in the same transaction that creates the user.
ALTER TABLE "AccessRequest" ADD COLUMN "portalUserId" TEXT;

CREATE UNIQUE INDEX "AccessRequest_portalUserId_key"
  ON "AccessRequest"("portalUserId");

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_portalUserId_fkey"
  FOREIGN KEY ("portalUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
